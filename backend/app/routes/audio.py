import os
import hashlib
import logging
from flask import Blueprint, jsonify, request, send_from_directory, abort, current_app
from werkzeug.utils import secure_filename
from app.services.audio_manager import get_or_generate_audio, get_audio_storage_dir
from app.services.tts_service import SUPPORTED_LANGUAGES, synthesize_speech
from app.services.ai_service import clean_text_for_narration

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


@audio_bp.route("/synthesize", methods=["POST", "OPTIONS"])
def synthesize_custom_audio():
    """
    POST /api/audio/synthesize
    Synthesizes custom text (such as AI responses) into MP3 speech audio
    using existing TTS infrastructure and caches to disk.
    """
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    language = (data.get("language") or "English").strip()

    if not text:
        return jsonify({
            "status": "error",
            "message": "Text content is required for speech synthesis.",
        }), 400

    if len(text) > 4000:
        return jsonify({
            "status": "error",
            "message": "Text content exceeds maximum limit of 4000 characters.",
        }), 400

    lang_match = next((l for l in SUPPORTED_LANGUAGES if l.lower() == language.lower()), None)
    if not lang_match:
        return jsonify({
            "status": "error",
            "message": f"Unsupported language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES.keys())}",
        }), 400
    language = lang_match

    try:
        clean_text = clean_text_for_narration(text)
        content_hash = hashlib.sha256(f"{language}:{clean_text}".encode("utf-8")).hexdigest()[:24]
        filename = f"ai_resp_{content_hash}.mp3"
        storage_dir = get_audio_storage_dir()
        file_path = os.path.join(storage_dir, filename)

        if not os.path.exists(file_path):
            synthesize_speech(clean_text, language, file_path)

        return jsonify({
            "status": "success",
            "data": {
                "audio_url": f"/api/audio/stream/{filename}",
                "filename": filename,
                "language": language,
            },
        }), 200
    except Exception as e:
        logger.error(f"Error synthesizing custom speech: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to synthesize audio: {str(e)}",
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
