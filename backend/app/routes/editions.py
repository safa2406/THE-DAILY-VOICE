import os
import io
import pypdf
import pytesseract
from flask import Blueprint, jsonify, request, abort, current_app
from sqlalchemy import func
from werkzeug.utils import secure_filename
from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article, VALID_CATEGORIES
from app.models.user import User
from app.models.user_edition import UserEdition
from app.middleware.auth import verify_jwt_token
from app.services.newspaper_importer import process_uploaded_newspaper_pdf
from app.services.pdf_extractor import check_tesseract_installed

editions_bp = Blueprint("editions", __name__, url_prefix="/api")


@editions_bp.route("/editions", methods=["GET"])
def list_editions():
    """
    GET /api/editions
    Lists all available newspaper editions with their metadata and article count.
    Publicly accessible.
    """
    # Subquery or join for article counts per edition
    article_counts = (
        db.session.query(
            Article.edition_id,
            func.count(Article.id).label("count")
        )
        .group_by(Article.edition_id)
        .subquery()
    )

    results = (
        db.session.query(Edition, func.coalesce(article_counts.c.count, 0))
        .outerjoin(article_counts, Edition.id == article_counts.c.edition_id)
        .order_by(Edition.publication_date.desc(), Edition.newspaper_name.asc())
        .all()
    )

    editions_list = []
    for edition, count in results:
        data = edition.to_dict(include_articles=False)
        data["article_count"] = count
        editions_list.append(data)

    return jsonify({
        "status": "success",
        "count": len(editions_list),
        "data": editions_list,
    }), 200


@editions_bp.route("/editions/<edition_id>", methods=["GET"])
def get_edition_details(edition_id: str):
    """
    GET /api/editions/<edition_id>
    Retrieves full metadata and ordered article list for the specified edition.
    Publicly accessible.
    """
    edition = db.session.get(Edition, edition_id)
    if not edition:
        abort(404, description=f"Edition with ID '{edition_id}' not found.")

    edition_dict = edition.to_dict(include_articles=True)
    edition_dict["article_count"] = len(edition.articles)

    return jsonify({
        "status": "success",
        "data": edition_dict,
    }), 200


@editions_bp.route("/editions/<edition_id>/articles", methods=["GET"])
def get_edition_articles(edition_id: str):
    """
    GET /api/editions/<edition_id>/articles
    Retrieves articles for an edition, with optional category filtering (?category=...).
    Publicly accessible.
    """
    edition = db.session.get(Edition, edition_id)
    if not edition:
        abort(404, description=f"Edition with ID '{edition_id}' not found.")

    category_filter = request.args.get("category", "").strip()

    query = db.session.query(Article).filter_by(edition_id=edition.id)

    if category_filter:
        # Case-insensitive category match
        query = query.filter(func.lower(Article.category) == category_filter.lower())

    articles = query.order_by(Article.page_number.asc(), Article.id.asc()).all()

    return jsonify({
        "status": "success",
        "edition_id": str(edition.id),
        "newspaper_name": edition.newspaper_name,
        "edition_code": edition.edition_code,
        "category_filter": category_filter or None,
        "count": len(articles),
        "data": [art.to_dict() for art in articles],
    }), 200


@editions_bp.route("/articles/<article_id>", methods=["GET"])
def get_article_details(article_id: str):
    """
    GET /api/articles/<article_id>
    Retrieves complete details for a single article, including parent newspaper metadata.
    Publicly accessible.
    """
    article = db.session.get(Article, article_id)
    if not article and "-" in article_id:
        article = (
            db.session.query(Article)
            .filter(Article.kicker.like(f"%{article_id}%"))
            .first()
        )
    if not article:
        abort(404, description=f"Article with ID '{article_id}' not found.")

    article_dict = article.to_dict()
    if article.edition:
        article_dict["newspaper_name"] = article.edition.newspaper_name
        article_dict["edition_code"] = article.edition.edition_code
        article_dict["publication_date"] = (
            article.edition.publication_date.isoformat()
            if article.edition.publication_date
            else None
        )

    return jsonify({
        "status": "success",
        "data": article_dict,
    }), 200


@editions_bp.route("/editions/upload", methods=["POST"])
def upload_edition_pdf():
    """
    POST /api/editions/upload
    Receives a newspaper PDF via multipart/form-data, extracts metadata and articles,
    persists the edition and articles idempotently, and returns the full edition payload.
    """
    if "file" not in request.files and "pdf" not in request.files:
        return jsonify({
            "status": "error",
            "message": "No PDF file provided in request. Please attach a file with key 'file' or 'pdf'."
        }), 400

    file = request.files.get("file") or request.files.get("pdf")
    if not file or not file.filename:
        return jsonify({
            "status": "error",
            "message": "No file selected for upload."
        }), 400

    filename = secure_filename(file.filename)
    if not filename.lower().endswith(".pdf"):
        return jsonify({
            "status": "error",
            "message": "Unsupported file format. Please upload a standard PDF broadsheet file."
        }), 400

    # Read bytes for validation
    file_bytes = file.read()
    if not file_bytes or len(file_bytes) == 0:
        return jsonify({
            "status": "error",
            "message": "The uploaded PDF file is empty (0 bytes)."
        }), 400

    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({
            "status": "error",
            "message": "File size exceeds maximum allowed limit of 50 MB."
        }), 413

    # Validate PDF structure with pypdf
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        if len(reader.pages) == 0:
            return jsonify({
                "status": "error",
                "message": "The uploaded PDF contains no readable pages."
            }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Corrupted or invalid PDF file: {str(e)}"
        }), 400

    # Check for extractable text layer vs scanned/image-only PDF
    total_text_len = sum(len(p.extract_text() or "") for p in reader.pages)
    is_scanned_pdf = total_text_len < 100

    if is_scanned_pdf and not check_tesseract_installed():
        return jsonify({
            "status": "error",
            "message": (
                "Scanned or image-only PDF detected, but Tesseract OCR engine is not installed or configured on the server. "
                "Please install Tesseract-OCR to enable scanned PDF processing."
            )
        }), 422

    # Save to uploads directory
    uploads_dir = os.path.abspath(
        os.path.join(current_app.root_path, "..", "uploads", "newspapers")
    )
    os.makedirs(uploads_dir, exist_ok=True)
    stored_path = os.path.join(uploads_dir, filename)
    with open(stored_path, "wb") as f:
        f.write(file_bytes)

    # Process and import
    try:
        result = process_uploaded_newspaper_pdf(stored_path, filename=filename)
    except pytesseract.TesseractNotFoundError:
        return jsonify({
            "status": "error",
            "message": (
                "Scanned or image-only PDF detected, but Tesseract OCR engine is not installed or configured on the server. "
                "Please install Tesseract-OCR to enable scanned PDF processing."
            )
        }), 422
    if not result.get("success"):
        return jsonify({
            "status": "error",
            "message": result.get("error", "Failed to process newspaper PDF.")
        }), 422

    edition = result["edition"]

    # If the uploading client is authenticated with a verified Supabase JWT, link edition to user
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(None, 1)[1].strip()
        try:
            payload = verify_jwt_token(token)
            user_id = payload.get("sub")
            if user_id:
                user = db.session.get(User, user_id)
                if not user:
                    user = User(
                        id=user_id,
                        email=payload.get("email") or f"user-{str(user_id)[:8]}@dailyvoice.com",
                        full_name=payload.get("full_name") or "Daily Voice Subscriber",
                        role="reader",
                        is_active=True,
                    )
                    db.session.add(user)
                    db.session.commit()
                existing_assoc = UserEdition.query.filter_by(
                    user_id=user_id, edition_id=edition.id
                ).first()
                if not existing_assoc:
                    new_assoc = UserEdition(
                        user_id=user_id,
                        edition_id=edition.id,
                        source="pdf_upload",
                    )
                    db.session.add(new_assoc)
                    db.session.commit()
        except Exception as e:
            current_app.logger.warning(f"Could not link uploaded PDF to user: {e}")

    edition_dict = edition.to_dict(include_articles=True)
    edition_dict["article_count"] = len(edition.articles)

    return jsonify({
        "status": "success",
        "message": f"Successfully processed '{edition.newspaper_name}' ({edition.edition_code}) with {len(edition.articles)} articles.",
        "data": edition_dict,
    }), 200
