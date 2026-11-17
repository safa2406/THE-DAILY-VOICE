import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from app.config.config import config_by_name
from app.models.base import db
# Ensure models are imported so Alembic discovers them
from app.models.user import User
from app.models.edition import Edition
from app.models.article import Article
from app.models.history import ListeningHistory
from app.models.bookmark import Bookmark
from app.models.audio_cache import AudioCache
from app.models.user_edition import UserEdition

migrate = Migrate()

def create_app(config_name: str | None = None) -> Flask:
    """
    Application factory pattern for Flask.
    """
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development").lower()

    app = Flask(__name__)

    # Load configuration
    config_class = config_by_name.get(config_name, config_by_name["default"])
    app.config.from_object(config_class)

    # Setup Logging
    logging.basicConfig(
        level=logging.DEBUG if app.config.get("DEBUG") else logging.INFO,
        format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
    )

    # Initialize Extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Configure CORS
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config.get("CORS_ORIGINS", ["http://localhost:5173", "http://127.0.0.1:5173"]),
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "allow_headers": ["Content-Type", "Authorization", "Accept", "Range"],
                "expose_headers": ["Content-Range", "Accept-Ranges", "Content-Length"],
                "supports_credentials": True,
            }
        },
    )

    # Register Blueprints
    from app.routes.health import health_bp
    from app.routes.auth import auth_bp
    from app.routes.editions import editions_bp
    from app.routes.audio import audio_bp
    from app.routes.user_activity import user_activity_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(editions_bp)
    app.register_blueprint(audio_bp, url_prefix="/api/audio")
    app.register_blueprint(user_activity_bp)

    # Register Custom CLI Commands
    from app.commands import register_commands
    register_commands(app)

    # Register Structured Error Handlers
    register_error_handlers(app)

    return app


def register_error_handlers(app: Flask):
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "status": "error",
            "code": "BAD_REQUEST",
            "message": getattr(error, "description", "Bad request."),
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            "status": "error",
            "code": "UNAUTHORIZED",
            "message": getattr(error, "description", "Unauthorized access."),
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            "status": "error",
            "code": "FORBIDDEN",
            "message": getattr(error, "description", "Forbidden."),
        }), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "status": "error",
            "code": "NOT_FOUND",
            "message": getattr(error, "description", "Requested resource was not found."),
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            "status": "error",
            "code": "METHOD_NOT_ALLOWED",
            "message": getattr(error, "description", "HTTP method not allowed for this endpoint."),
        }), 405

    @app.errorhandler(500)
    def internal_server_error(error):
        app.logger.error(f"Server error: {error}")
        return jsonify({
            "status": "error",
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An internal server error occurred.",
        }), 500
