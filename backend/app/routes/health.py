from datetime import datetime, timezone
from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from app.models.base import db
from app.services.supabase_client import SupabaseService

health_bp = Blueprint("health", __name__, url_prefix="/api")

@health_bp.route("/health", methods=["GET"])
def health_check():
    """
    Health check endpoint returning real service and database status.
    Does not fake database connectivity.
    """
    now = datetime.now(timezone.utc).isoformat()
    db_status = "disconnected"
    db_error = None

    try:
        # Check actual database connectivity using a basic query
        db.session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = "disconnected"
        db_error = str(e)

    supabase_configured = SupabaseService.is_configured()

    overall_status = "healthy" if db_status == "connected" else "degraded"

    response_payload = {
        "status": overall_status,
        "service": "The Daily Voice API",
        "version": "1.0.0-phase1",
        "timestamp": now,
        "environment": current_app.config.get("ENV", "development"),
        "checks": {
            "database": {
                "status": db_status,
                "error": db_error,
            },
            "supabase": {
                "configured": supabase_configured,
                "url": current_app.config.get("SUPABASE_URL", "") if supabase_configured else "not_configured",
            },
        },
    }

    # Return 200 even if degraded so client can inspect system diagnostics
    return jsonify(response_payload), 200
