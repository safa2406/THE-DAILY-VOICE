import time
import uuid
from unittest.mock import MagicMock, patch
import jwt
from flask import current_app
from cryptography.hazmat.primitives.asymmetric import rsa

VALID_UUID = str(uuid.uuid4())

def create_hs256_token(
    sub=VALID_UUID,
    email="reader@dailyvoice.com",
    secret=None,
    exp_delta=3600,
    aud="authenticated",
    iss=None,
):
    """Generates a signed HS256 JWT token for test purposes."""
    if secret is None:
        secret = current_app.config["SUPABASE_JWT_SECRET"]
    payload = {
        "sub": sub,
        "email": email,
        "role": "authenticated",
        "aud": aud,
        "exp": int(time.time()) + exp_delta,
        "iat": int(time.time()),
    }
    if iss:
        payload["iss"] = iss
    return jwt.encode(payload, secret, algorithm="HS256")


def test_auth_missing_header(client):
    """Rejects requests with missing Authorization header."""
    response = client.get("/api/auth/verify")
    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "AUTH_HEADER_MISSING"


def test_auth_invalid_header_format(client):
    """Rejects malformed Authorization header."""
    response = client.get(
        "/api/auth/verify",
        headers={"Authorization": "InvalidBearerFormat"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "INVALID_AUTH_FORMAT"


def test_auth_invalid_signature(client, app):
    """Rejects token signed with wrong secret/key."""
    with app.app_context():
        wrong_token = create_hs256_token(secret="completely-wrong-test-secret-key-12345")

    response = client.get(
        "/api/auth/verify",
        headers={"Authorization": f"Bearer {wrong_token}"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "INVALID_SIGNATURE"


def test_auth_expired_token(client, app):
    """Rejects expired JWT tokens."""
    with app.app_context():
        expired_token = create_hs256_token(exp_delta=-60)

    response = client.get(
        "/api/auth/verify",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "TOKEN_EXPIRED"


def test_auth_invalid_audience(client, app):
    """Rejects tokens with mismatched audience."""
    with app.app_context():
        bad_aud_token = create_hs256_token(aud="wrong-audience")

    response = client.get(
        "/api/auth/verify",
        headers={"Authorization": f"Bearer {bad_aud_token}"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "INVALID_AUDIENCE"


def test_auth_invalid_uuid_subject(client, app):
    """Rejects tokens where subject (sub) is not a valid UUID."""
    with app.app_context():
        non_uuid_token = create_hs256_token(sub="non-uuid-string-123")

    response = client.get(
        "/api/auth/verify",
        headers={"Authorization": f"Bearer {non_uuid_token}"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "INVALID_SUBJECT"
    assert "UUID" in data["message"]


def test_auth_valid_hs256_token_when_explicitly_configured(client, app):
    """Accepts valid HS256 token ONLY when SUPABASE_AUTH_STRATEGY='hs256' is explicitly configured."""
    test_sub = str(uuid.uuid4())
    with app.app_context():
        app.config["SUPABASE_AUTH_STRATEGY"] = "hs256"
        valid_token = create_hs256_token(sub=test_sub, email="alice@dailyvoice.com")

    response = client.get(
        "/api/auth/verify",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["user"]["id"] == test_sub
    assert data["user"]["email"] == "alice@dailyvoice.com"


def test_jwks_does_not_silently_fallback_to_hs256(client, app):
    """
    CRITICAL SECURITY CHECK:
    When primary JWKS strategy is active, an incoming HS256 token MUST NOT be accepted
    even if SUPABASE_JWT_SECRET is populated in config.
    """
    with app.app_context():
        app.config["SUPABASE_AUTH_STRATEGY"] = "jwks"
        app.config["SUPABASE_JWKS_URL"] = "https://mock.supabase.co/auth/v1/.well-known/jwks.json"
        app.config["SUPABASE_JWT_SECRET"] = "super-secret-hs256-key-32-chars-min"

        # Generate HS256 token signed with SUPABASE_JWT_SECRET
        hs256_token = create_hs256_token(secret="super-secret-hs256-key-32-chars-min")

        # Mock JWKS client returning an asymmetric key (not accepting HS256)
        mock_pyjwk = MagicMock()
        mock_pyjwk.key = rsa.generate_private_key(65537, 2048).public_key()

        with patch("app.middleware.auth.get_jwks_client") as mock_get_client:
            mock_client_instance = MagicMock()
            mock_client_instance.get_signing_key_from_jwt.return_value = mock_pyjwk
            mock_get_client.return_value = mock_client_instance

            response = client.get(
                "/api/auth/verify",
                headers={"Authorization": f"Bearer {hs256_token}"},
            )

    # Must be rejected because JWKS strategy restricts algorithms to RS256/ES256
    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] in ("INVALID_TOKEN", "INVALID_SIGNATURE")


def test_jwks_missing_url_rejects_without_hs256_fallback(client, app):
    """
    CRITICAL SECURITY CHECK:
    When JWKS is configured but SUPABASE_JWKS_URL is empty/missing, the backend
    MUST NOT silently fall back to HS256 even if SUPABASE_JWT_SECRET exists.
    """
    with app.app_context():
        app.config["SUPABASE_AUTH_STRATEGY"] = "jwks"
        app.config["SUPABASE_JWKS_URL"] = ""
        app.config["SUPABASE_JWT_SECRET"] = "super-secret-hs256-key-32-chars-min"

        token = create_hs256_token(secret="super-secret-hs256-key-32-chars-min")

        response = client.get(
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "AUTH_CONFIG_ERROR"
    assert "SUPABASE_JWKS_URL is not configured" in data["message"]


def test_hs256_missing_secret_rejects(client, app):
    """Explicit HS256 strategy rejects request if SUPABASE_JWT_SECRET is missing."""
    with app.app_context():
        app.config["SUPABASE_AUTH_STRATEGY"] = "hs256"
        app.config["SUPABASE_JWT_SECRET"] = ""

        token = create_hs256_token(secret="this-is-a-32-byte-secret-key-for-testing!!")

        response = client.get(
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    data = response.get_json()
    assert data["code"] == "AUTH_CONFIG_ERROR"
    assert "SUPABASE_JWT_SECRET is missing" in data["message"]


def test_auth_asymmetric_jwks_verification(client, app):
    """
    Verifies the approved primary asymmetric JWKS strategy:
    - Token signed with RSA private key (RS256) with valid UUID subject, issuer, and audience.
    - App configured with JWKS strategy.
    - Mocks PyJWKClient returning public key.
    - Successfully authenticates user.
    """
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    
    test_sub = str(uuid.uuid4())
    mock_issuer = "https://mock-project.supabase.co/auth/v1"
    
    headers = {"kid": "supabase-test-key-1"}
    payload = {
        "sub": test_sub,
        "email": "asymmetric-user@dailyvoice.com",
        "role": "authenticated",
        "aud": "authenticated",
        "iss": mock_issuer,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    
    rs256_token = jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
        headers=headers,
    )

    with app.app_context():
        app.config["SUPABASE_AUTH_STRATEGY"] = "jwks"
        app.config["SUPABASE_JWKS_URL"] = f"{mock_issuer}/.well-known/jwks.json"
        app.config["SUPABASE_JWT_ISSUER"] = mock_issuer
        app.config["SUPABASE_JWT_AUDIENCE"] = "authenticated"

        mock_pyjwk = MagicMock()
        mock_pyjwk.key = public_key

        with patch("app.middleware.auth.get_jwks_client") as mock_get_client:
            mock_client_instance = MagicMock()
            mock_client_instance.get_signing_key_from_jwt.return_value = mock_pyjwk
            mock_get_client.return_value = mock_client_instance

            response = client.get(
                "/api/auth/verify",
                headers={"Authorization": f"Bearer {rs256_token}"},
            )

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["user"]["id"] == test_sub
    assert data["user"]["email"] == "asymmetric-user@dailyvoice.com"
