import os
import logging
from flask import Blueprint, jsonify, request, send_from_directory, abort, current_app
from werkzeug.utils import secure_filename
from app.services.audio_manager import get_or_generate_audio, get_audio_storage_dir
from app.services.tts_service import SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

audio_bp = Blueprint("audio", __name__)


@audio_bp.route("/languages", methods=["GET", "OPTIONS"])
def list_supported_languages():
    """
    GET /api/audio/languages
    Returns the list of 5 supported Indian languages and metadata.
    """
    if request.method == "OPTIONS":
        return "", 204

    langs = [
        {
            "id": k,
            "name": k,
            "code": v["code"],
            "locale": v["locale"],
            "label": v["label"],
            "voice": v["voice"],
            "is_default": (k == "English"),
        }
        for k, v in SUPPORTED_LANGUAGES.items()
    ]
    return jsonify({
        "status": "success",
        "data": langs,
    }), 200


@audio_bp.route("/generate", methods=["POST", "OPTIONS"])
def generate_audio():
    """
    POST /api/audio/generate
    Generates or retrieves cached audio for:
    - mode: 'headlines' (reads edition headlines)
    - mode: 'summary' (generates 30-45s AI summary)
    - mode: 'full' (reads unabridged article content)
    - language: 'English' (default), 'Hindi', 'Kannada', 'Telugu', 'Marathi'
    """
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True) or {}

    article_id = data.get("article_id")
    edition_id = data.get("edition_id")
    mode = data.get("mode", "summary")
    language = data.get("language", "English")

    try:
        result = get_or_generate_audio(
            article_id=article_id,
            edition_id=edition_id,
            mode=mode,
            language=language,
        )
        return jsonify({
            "status": "success",
            "data": result,
        }), 200
    except ValueError as e:
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 400
    except Exception as e:
        logger.error(f"Error in audio generation: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to generate audio narration: {str(e)}",
        }), 500


@audio_bp.route("/stream/<path:filename>", methods=["GET", "OPTIONS"])
def stream_audio(filename: str):
    """
    GET /api/audio/stream/<filename>
    Streams generated MP3 audio file with HTTP Range support for scrubbing/seeking.
    """
    if request.method == "OPTIONS":
        return "", 204
    safe_name = secure_filename(filename)
    storage_dir = get_audio_storage_dir()

    file_path = os.path.join(storage_dir, safe_name)
    if not os.path.exists(file_path):
        abort(404, description=f"Audio file '{safe_name}' not found.")

    return send_from_directory(
        storage_dir,
        safe_name,
        mimetype="audio/mpeg",
        as_attachment=False,
        conditional=True,  # Enables HTTP 206 Partial Content / Range headers
    )
