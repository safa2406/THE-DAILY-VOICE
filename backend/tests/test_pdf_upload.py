import io
import os
import pytest
from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article, VALID_CATEGORIES


def get_sample_pdf_bytes(rel_path: str) -> bytes:
    """Reads PDF bytes from workspace sample directory."""
    candidates = [
        rel_path,
        os.path.join(os.getcwd(), rel_path),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", rel_path)),
    ]
    for c in candidates:
        if os.path.exists(c):
            with open(c, "rb") as f:
                return f.read()
    raise FileNotFoundError(f"Sample PDF not found at {rel_path}")


def test_upload_no_file_rejected(client):
    """POST /api/editions/upload without file part returns 400."""
    res = client.post("/api/editions/upload")
    assert res.status_code == 400
    assert res.json["status"] == "error"
    assert "No PDF file provided" in res.json["message"]


def test_upload_non_pdf_file_rejected(client):
    """POST /api/editions/upload with non-PDF extension returns 400."""
    res = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(b"Hello world broadsheet"), "newspaper.txt")},
    )
    assert res.status_code == 400
    assert res.json["status"] == "error"
    assert "Unsupported file format" in res.json["message"]


def test_upload_empty_pdf_rejected(client):
    """POST /api/editions/upload with 0-byte PDF returns 400."""
    res = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(b""), "empty.pdf")},
    )
    assert res.status_code == 400
    assert res.json["status"] == "error"
    assert "empty" in res.json["message"].lower()


def test_upload_corrupted_pdf_rejected(client):
    """POST /api/editions/upload with corrupted PDF bytes returns 400."""
    res = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(b"%PDF-corrupted-stream-bytes-here"), "corrupted.pdf")},
    )
    assert res.status_code == 400
    assert res.json["status"] == "error"
    assert "Corrupted or invalid" in res.json["message"]


def test_upload_the_gazette_noqr_pdf(client, app):
    """Uploads ED001_The_Gazette.pdf and verifies metadata, article counts, and categorization."""
    pdf_bytes = get_sample_pdf_bytes("sample_newspapers/NoQR/ED001_The_Gazette.pdf")

    res = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(pdf_bytes), "ED001_The_Gazette.pdf")},
    )

    assert res.status_code == 200
    assert res.json["status"] == "success"

    data = res.json["data"]
    assert data["newspaper_name"] == "The Gazette"
    assert data["edition_code"] == "ED001"
    assert data["publication_date"] == "2026-11-07"
    assert data["has_qr"] is False
    assert data["page_count"] == 5
    assert data["article_count"] == 20
    assert len(data["articles"]) == 20

    # Verify all articles have valid category and preserved codes
    for art in data["articles"]:
        assert art["category"] in VALID_CATEGORIES
        assert art["headline"] and len(art["headline"].strip()) > 0
        assert art["content"] and len(art["content"].strip()) > 0
        assert art["article_code"] and art["article_code"].startswith("TG-")

    # Confirm database persistence
    with app.app_context():
        edition_in_db = (
            db.session.query(Edition)
            .filter_by(newspaper_name="The Gazette", publication_date="2026-11-07")
            .first()
        )
        assert edition_in_db is not None
        assert len(edition_in_db.articles) == 20


def test_upload_the_daily_post_noqr_pdf(client, app):
    """Uploads ED002_The_Daily_Post.pdf and verifies extracted broadsheet articles."""
    pdf_bytes = get_sample_pdf_bytes("sample_newspapers/NoQR/ED002_The_Daily_Post.pdf")

    res = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(pdf_bytes), "ED002_The_Daily_Post.pdf")},
    )

    assert res.status_code == 200
    assert res.json["status"] == "success"

    data = res.json["data"]
    assert data["newspaper_name"] == "The Daily Post"
    assert data["edition_code"] == "ED002"
    assert data["publication_date"] == "2026-11-08"
    assert data["has_qr"] is False
    assert data["article_count"] == 20

    for art in data["articles"]:
        assert art["category"] in VALID_CATEGORIES
        assert art["article_code"].startswith("DP-")


def test_upload_the_national_standard_noqr_pdf(client, app):
    """Uploads ED003_The_National_Standard.pdf and verifies extracted broadsheet articles."""
    pdf_bytes = get_sample_pdf_bytes("sample_newspapers/NoQR/ED003_The_National_Standard.pdf")

    res = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(pdf_bytes), "ED003_The_National_Standard.pdf")},
    )

    assert res.status_code == 200
    assert res.json["status"] == "success"

    data = res.json["data"]
    assert data["newspaper_name"] == "The National Standard"
    assert data["edition_code"] == "ED003"
    assert data["publication_date"] == "2026-11-09"
    assert data["has_qr"] is False
    assert data["article_count"] == 20

    for art in data["articles"]:
        assert art["category"] in VALID_CATEGORIES
        assert art["article_code"].startswith("NS-")


def test_upload_idempotency_prevents_duplicate_editions(client, app):
    """Uploading the same broadsheet PDF repeatedly must not create duplicate editions or articles."""
    pdf_bytes = get_sample_pdf_bytes("sample_newspapers/NoQR/ED001_The_Gazette.pdf")

    # First upload
    res1 = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(pdf_bytes), "ED001_The_Gazette.pdf")},
    )
    assert res1.status_code == 200
    edition_id_1 = res1.json["data"]["id"]

    # Second upload of the identical newspaper
    res2 = client.post(
        "/api/editions/upload",
        data={"file": (io.BytesIO(pdf_bytes), "ED001_The_Gazette.pdf")},
    )
    assert res2.status_code == 200
    edition_id_2 = res2.json["data"]["id"]

    assert edition_id_1 == edition_id_2

    with app.app_context():
        gazette_editions = (
            db.session.query(Edition)
            .filter_by(newspaper_name="The Gazette")
            .all()
        )
        assert len(gazette_editions) == 1

        gazette_articles = (
            db.session.query(Article)
            .filter_by(edition_id=edition_id_1)
            .all()
        )
        assert len(gazette_articles) == 20
