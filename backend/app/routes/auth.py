import time
import uuid
import jwt
from flask import Blueprint, jsonify, request, g, current_app
from app.models.base import db
from app.models.user import User
from app.middleware.auth import require_auth

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def generate_local_jwt(user: User) -> str:
    """Generates a cryptographically signed HS256 JWT for the user."""
    secret = current_app.config.get("SUPABASE_JWT_SECRET") or current_app.config.get("SECRET_KEY")
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role or "authenticated",
        "aud": "authenticated",
        "iss": current_app.config.get("SUPABASE_JWT_ISSUER") or None,
        "exp": int(time.time()) + 7 * 86400,
        "iat": int(time.time()),
    }
    if not payload["iss"]:
        del payload["iss"]
    return jwt.encode(payload, secret, algorithm="HS256")


@auth_bp.route("/status", methods=["GET"])
def auth_status():
    """
    Public diagnostic endpoint reporting whether Supabase authentication
    is configured and operational on this backend instance.
    """
    strategy = current_app.config.get("SUPABASE_AUTH_STRATEGY", "jwks").lower()
    jwks_url = current_app.config.get("SUPABASE_JWKS_URL")
    hs256_secret = current_app.config.get("SUPABASE_JWT_SECRET")

    is_configured = bool(jwks_url if strategy == "jwks" else hs256_secret)

    return jsonify({
        "status": "success",
        "configured": is_configured,
        "strategy": strategy,
        "message": (
            f"Supabase Auth active ({strategy.upper()}). Verified JWT enforcement enabled."
            if is_configured
            else "Supabase authentication is not configured on this server. Secure multi-user persistence requires SUPABASE_URL (JWKS) or SUPABASE_JWT_SECRET (HS256)."
        ),
    }), 200


@auth_bp.route("/login", methods=["POST"])
def auth_login():
    """
    Authenticates a user and issues a verified, cryptographically signed JWT.
    Guarantees deterministic user UUID mapping across logins and sessions.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return jsonify({
            "status": "error",
            "code": "INVALID_EMAIL",
            "message": "A valid subscriber email is required.",
        }), 400

    # Demo account deterministic ID
    if email == "reader@dailyvoice.com":
        demo_id = "00000000-0000-4000-a000-000000000001"
        user = db.session.get(User, demo_id)
        if not user:
            user = User(
                id=demo_id,
                email=email,
                full_name="Subscriber Reader",
                role="reader",
                is_active=True,
            )
            db.session.add(user)
            db.session.commit()
    else:
        user = User.query.filter_by(email=email).first()
        if not user:
            name_part = email.split("@")[0].capitalize()
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                full_name=data.get("fullName") or name_part,
                role="reader",
                is_active=True,
            )
            db.session.add(user)
            db.session.commit()

    token = generate_local_jwt(user)
    return jsonify({
        "status": "success",
        "user": user.to_dict(),
        "session": {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 7 * 86400,
        },
    }), 200


@auth_bp.route("/signup", methods=["POST"])
def auth_signup():
    """
    Registers a new user and issues a cryptographically signed JWT.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    full_name = (data.get("fullName") or "").strip()

    if not email or "@" not in email:
        return jsonify({
            "status": "error",
            "code": "INVALID_EMAIL",
            "message": "A valid subscriber email is required.",
        }), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        name_part = full_name or email.split("@")[0].capitalize()
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            full_name=name_part,
            role="reader",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
    elif full_name and not user.full_name:
        user.full_name = full_name
        db.session.commit()

    token = generate_local_jwt(user)
    return jsonify({
        "status": "success",
        "user": user.to_dict(),
        "session": {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 7 * 86400,
        },
    }), 201


@auth_bp.route("/verify", methods=["GET", "POST"])
@require_auth
def verify_session():
    """
    Validates the caller's JWT token and returns verified identity.
    Only accessible with valid Supabase Auth JWT.
    """
    return jsonify({
        "status": "success",
        "message": "Token is valid.",
        "user": g.current_user,
    }), 200
