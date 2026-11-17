import uuid
import logging
from functools import wraps
import jwt
from jwt import PyJWKClient, PyJWKClientError
from flask import request, jsonify, current_app, g

logger = logging.getLogger(__name__)

# Cache of PyJWKClients keyed by JWKS URL
_jwks_clients: dict[str, PyJWKClient] = {}

def get_jwks_client(jwks_url: str) -> PyJWKClient:
    """Returns or caches a PyJWKClient instance for key rotation and caching."""
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_clients[jwks_url]


def validate_uuid(val: str | None) -> str:
    """Validates that a string is a valid UUID format."""
    if not val:
        raise ValueError("Subject (sub) claim is missing.")
    try:
        parsed = uuid.UUID(str(val))
        return str(parsed)
    except (ValueError, TypeError, AttributeError):
        raise ValueError(f"Subject claim '{val}' is not a valid UUID format.")


def verify_jwt_token(token: str) -> dict:
    """
    Decodes and validates a Supabase Auth JWT token according to the approved architecture:
    1. Primary Strategy: Asymmetric verification via Supabase JWKS (RS256 / ES256).
       - Validates signing key via JWKS kid.
       - Validates issuer and audience.
       - Validates subject UUID format.
       - If JWKS is missing or unavailable, DOES NOT silently fall back to HS256.
    2. Legacy HS256 verification: STRICTLY opt-in via explicit configuration
       (SUPABASE_AUTH_STRATEGY='hs256').
    """
    strategy = current_app.config.get("SUPABASE_AUTH_STRATEGY", "jwks").lower()
    jwks_url = current_app.config.get("SUPABASE_JWKS_URL")
    issuer = current_app.config.get("SUPABASE_JWT_ISSUER")
    audience = current_app.config.get("SUPABASE_JWT_AUDIENCE", "authenticated")
    hs256_secret = current_app.config.get("SUPABASE_JWT_SECRET")

    # Strategy 1: Asymmetric JWKS verification (Primary Approved Strategy - Default)
    if strategy == "jwks":
        if not jwks_url:
            raise ValueError(
                "JWKS authentication is the active strategy, but SUPABASE_JWKS_URL is not configured."
            )
        try:
            jwks_client = get_jwks_client(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            
            decode_kwargs = {
                "jwt": token,
                "key": signing_key.key,
                "algorithms": ["RS256", "ES256"],
                "options": {
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": bool(audience),
                    "verify_iss": bool(issuer),
                },
            }
            if audience:
                decode_kwargs["audience"] = audience
            if issuer:
                decode_kwargs["issuer"] = issuer

            payload = jwt.decode(**decode_kwargs)
        except PyJWKClientError as e:
            logger.error(f"JWKS key retrieval failed: {e}")
            raise jwt.PyJWTError(f"JWKS key retrieval failed: {e}")

    # Strategy 2: Legacy HS256 verification (STRICTLY opt-in via explicit configuration)
    elif strategy == "hs256":
        if not hs256_secret:
            raise ValueError(
                "Explicit HS256 strategy configured (SUPABASE_AUTH_STRATEGY='hs256'), but SUPABASE_JWT_SECRET is missing."
            )
        decode_kwargs = {
            "jwt": token,
            "key": hs256_secret,
            "algorithms": ["HS256"],
            "options": {
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": bool(audience),
                "verify_iss": bool(issuer),
            },
        }
        if audience:
            decode_kwargs["audience"] = audience
        if issuer:
            decode_kwargs["issuer"] = issuer

        payload = jwt.decode(**decode_kwargs)
    else:
        raise ValueError(
            f"Unsupported authentication strategy: '{strategy}'. Supported strategies: 'jwks' (default) or 'hs256'."
        )

    # Validate that subject claim is a valid UUID (Supabase Auth identity)
    validate_uuid(payload.get("sub"))

    return payload


def require_auth(f):
    """
    Route decorator requiring a valid Supabase JWT Bearer token.
    Enforces asymmetric JWKS key validation, issuer, audience, and UUID subject.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            return jsonify({
                "status": "error",
                "code": "AUTH_HEADER_MISSING",
                "message": "Authorization header is required.",
            }), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({
                "status": "error",
                "code": "INVALID_AUTH_FORMAT",
                "message": "Authorization header must follow format: Bearer <token>",
            }), 401

        token = parts[1]
        try:
            payload = verify_jwt_token(token)
            # Attach verified identity to Flask request context
            g.current_user = {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "role": payload.get("role", "authenticated"),
                "claims": payload,
            }
        except jwt.ExpiredSignatureError:
            return jsonify({
                "status": "error",
                "code": "TOKEN_EXPIRED",
                "message": "Authentication token has expired.",
            }), 401
        except jwt.InvalidSignatureError:
            return jsonify({
                "status": "error",
                "code": "INVALID_SIGNATURE",
                "message": "Authentication token signature is invalid.",
            }), 401
        except jwt.InvalidIssuerError:
            return jsonify({
                "status": "error",
                "code": "INVALID_ISSUER",
                "message": "Authentication token issuer is invalid.",
            }), 401
        except jwt.InvalidAudienceError:
            return jsonify({
                "status": "error",
                "code": "INVALID_AUDIENCE",
                "message": "Authentication token audience is invalid.",
            }), 401
        except ValueError as e:
            # Handles invalid UUID subject or configuration errors
            return jsonify({
                "status": "error",
                "code": "INVALID_SUBJECT" if "UUID" in str(e) else "AUTH_CONFIG_ERROR",
                "message": str(e),
            }), 401
        except jwt.PyJWTError as e:
            return jsonify({
                "status": "error",
                "code": "INVALID_TOKEN",
                "message": f"Token validation failed: {str(e)}",
            }), 401

        return f(*args, **kwargs)

    return decorated
