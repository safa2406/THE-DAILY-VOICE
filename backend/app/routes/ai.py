import logging
from flask import Blueprint, jsonify, request, g
from app.models.base import db
from app.models.article import Article
from app.middleware.auth import require_auth
from app.services.ai_service import ask_ai_about_article, SUPPORTED_INDIC_LANGS

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__, url_prefix="/api")


@ai_bp.route("/articles/<article_id>/ask", methods=["POST", "OPTIONS"])
@ai_bp.route("/ai/ask", methods=["POST", "OPTIONS"])
@require_auth
def ask_article_ai(article_id: str | None = None):
    """
    POST /api/articles/<article_id>/ask or POST /api/ai/ask
    Protected endpoint to ask questions about a newspaper article.
    Uses article context from the database and queries Groq AI.
    """
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True) or {}
    target_article_id = article_id or data.get("article_id")

    if not target_article_id:
        return jsonify({
            "status": "error",
            "code": "ARTICLE_ID_REQUIRED",
            "message": "Article ID is required.",
        }), 400

    article = db.session.get(Article, target_article_id)
    if not article and "-" in str(target_article_id):
        article = db.session.query(Article).filter(Article.kicker.like(f"%{target_article_id}%")).first()

    # If article still not found and target_article_id is a sampleData reference (e.g. art-001)
    if not article and str(target_article_id).startswith("art-"):
        sample_num = str(target_article_id).replace("art-", "").lstrip("0")
        idx = int(sample_num) - 1 if sample_num.isdigit() else 0
        all_arts = Article.query.order_by(Article.id.asc()).limit(10).all()
        if all_arts and 0 <= idx < len(all_arts):
            article = all_arts[idx]
        elif all_arts:
            article = all_arts[0]

    if not article:
        return jsonify({
            "status": "error",
            "code": "ARTICLE_NOT_FOUND",
            "message": f"Article with ID '{target_article_id}' was not found in the database.",
        }), 404

    question = data.get("question", "")
    if not isinstance(question, str) or not question.strip():
        return jsonify({
            "status": "error",
            "code": "EMPTY_QUESTION",
            "message": "Question text cannot be empty.",
        }), 400

    clean_question = question.strip()
    if len(clean_question) > 1000:
        return jsonify({
            "status": "error",
            "code": "QUESTION_TOO_LONG",
            "message": "Question exceeds maximum allowed length of 1000 characters.",
        }), 400

    language = data.get("language", "English")
    allowed_langs = ["English"] + list(SUPPORTED_INDIC_LANGS.keys())
    matched_lang = next((l for l in allowed_langs if l.lower() == str(language).lower()), None)
    if not matched_lang:
        return jsonify({
            "status": "error",
            "code": "UNSUPPORTED_LANGUAGE",
            "message": f"Unsupported language '{language}'. Supported: {', '.join(allowed_langs)}",
        }), 400

    history = data.get("history", [])
    if not isinstance(history, list):
        history = []

    try:
        result = ask_ai_about_article(
            article=article,
            question=clean_question,
            history=history,
            language=matched_lang,
        )
        return jsonify({
            "status": "success",
            "data": result,
        }), 200
    except RuntimeError as e:
        err_msg = str(e)
        logger.error(f"Ask AI RuntimeError: {err_msg}")
        if "GROQ_API_KEY is not configured" in err_msg:
            return jsonify({
                "status": "error",
                "code": "AI_CONFIG_MISSING",
                "message": "Groq AI service is not configured. Please set the GROQ_API_KEY environment variable.",
            }), 503
        if "429" in err_msg.lower() or "rate limit" in err_msg.lower():
            return jsonify({
                "status": "error",
                "code": "AI_RATE_LIMIT",
                "message": "Groq AI rate limit reached. Please wait a moment before asking another question.",
            }), 429
        if "timeout" in err_msg.lower():
            return jsonify({
                "status": "error",
                "code": "AI_TIMEOUT",
                "message": "Groq AI service request timed out. Please try again.",
            }), 504
        return jsonify({
            "status": "error",
            "code": "AI_SERVICE_ERROR",
            "message": f"The AI service failed to generate an answer: {err_msg}",
        }), 500
    except ValueError as e:
        return jsonify({
            "status": "error",
            "code": "INVALID_REQUEST",
            "message": str(e),
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error in Ask AI: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred while processing your request.",
        }), 500
