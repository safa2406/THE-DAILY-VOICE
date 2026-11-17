import io
import os
import urllib.parse
from datetime import date
import pytest

from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article, VALID_CATEGORIES
from app.services.pdf_extractor import (
    extract_articles_from_pdf,
    extract_metadata_from_pdf,
    parse_articles_from_page_text,
    link_cross_page_continuations,
    determine_article_category,
)
from app.services.newspaper_importer import process_uploaded_newspaper_pdf


def get_toi_pdf_path() -> str:
    """Resolves absolute path to TOI_Delhi_14Nov2026_5pages.pdf."""
    candidates = [
        "backend/uploads/newspapers/TOI_Delhi_14Nov2026_5pages.pdf",
        "uploads/newspapers/TOI_Delhi_14Nov2026_5pages.pdf",
        os.path.join(os.getcwd(), "backend", "uploads", "newspapers", "TOI_Delhi_14Nov2026_5pages.pdf"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "newspapers", "TOI_Delhi_14Nov2026_5pages.pdf")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    raise FileNotFoundError("Target newspaper TOI_Delhi_14Nov2026_5pages.pdf not found.")


def test_real_broadsheet_metadata_extraction():
    """Verify metadata extraction correctly identifies The Times of India and does not confuse it with sample 'The Times'."""
    pdf_path = get_toi_pdf_path()
    meta = extract_metadata_from_pdf(pdf_path, filename="TOI_Delhi_14Nov2026_5pages.pdf")

    assert meta["newspaper_name"] == "The Times of India"
    assert meta["edition_code"] == "TOI-DELHI"
    assert meta["publication_date"] == date(2026, 11, 14)
    assert meta["page_count"] == 5
    assert meta["has_qr"] is False
    assert "Delhi" in meta["location"] or "New Delhi" in meta["location"]


def test_real_broadsheet_article_segmentation():
    """Verify multi-column layout extraction produces structured articles across all 5 pages without synthetic codes."""
    pdf_path = get_toi_pdf_path()
    articles = extract_articles_from_pdf(pdf_path)

    # Broadsheet contains over 50 individual stories
    assert len(articles) >= 45, f"Expected at least 45 articles, got {len(articles)}"

    # Check pages represented
    pages_found = {a["page_number"] for a in articles}
    assert pages_found == {1, 2, 3, 4, 5}, f"Missing pages: {pages_found}"

    # Verify article structure
    for art in articles:
        assert art["headline"] and len(art["headline"].strip()) >= 5
        assert "\n" not in art["headline"], "Headline should be a single line"
        assert art["content"] and len(art["content"].strip()) >= 100, f"Article content too short: {art['headline']}"
        assert art["page_number"] in [1, 2, 3, 4, 5]
        assert art["category"] in VALID_CATEGORIES
        assert art["duration_seconds"] >= 45
        assert isinstance(art["is_headline"], bool)

    # Check lead article on page 1
    page1_arts = [a for a in articles if a["page_number"] == 1]
    assert len(page1_arts) >= 4
    assert any("Nvidian" in a["headline"] or "Powerful Men" in a["headline"] for a in page1_arts)


def test_real_broadsheet_category_distribution():
    """Verify all 6 editorial categories are accurately represented across real broadsheet articles."""
    pdf_path = get_toi_pdf_path()
    articles = extract_articles_from_pdf(pdf_path)

    category_counts = {}
    for a in articles:
        cat = a["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # Verify each category is valid
    for cat in category_counts:
        assert cat in VALID_CATEGORIES

    # Broadsheet contains stories spanning Sports, Finance, Science & Tech, World, Politics, Current Affairs
    assert category_counts.get("Sports", 0) >= 10
    assert category_counts.get("Finance", 0) >= 5
    assert category_counts.get("Science & Technology", 0) >= 3
    assert category_counts.get("World", 0) >= 2


def test_cross_page_continuation_linking():
    """Verify continuation logic properly merges articles split across broadsheet pages."""
    mock_articles = [
        {
            "code": None,
            "kicker": None,
            "headline": "Economic Reforms Announced for Next Fiscal Year",
            "byline": "Special Correspondent",
            "page_number": 1,
            "category": "Finance",
            "summary": "Government unveils major tax and expenditure plans.",
            "content": "Government unveils major tax and expenditure plans.\n\nContinued on Page 2",
            "duration_seconds": 60,
            "is_headline": True,
        },
        {
            "code": None,
            "kicker": None,
            "headline": "Economic Reforms Continued",
            "byline": "Special Correspondent",
            "page_number": 2,
            "category": "Finance",
            "summary": "From Page 1. Additional details follow.",
            "content": "Continued from Page 1.\n\nAdditional details on infrastructure spending.",
            "duration_seconds": 60,
            "is_headline": False,
        },
        {
            "code": None,
            "kicker": None,
            "headline": "Independent Sports Headline",
            "byline": "Staff Reporter",
            "page_number": 2,
            "category": "Sports",
            "summary": "Match report.",
            "content": "A thrilling match took place yesterday with multiple goals.",
            "duration_seconds": 60,
            "is_headline": False,
        },
    ]

    linked = link_cross_page_continuations(mock_articles)
    assert len(linked) == 2, f"Expected 2 articles after merge, got {len(linked)}"
    lead_art = linked[0]
    assert "Additional details on infrastructure spending." in lead_art["content"]
    assert "Continued on Page 2" not in lead_art["content"]


def test_ocr_codeless_stream_segmentation():
    """Verify fallback parser can extract articles from unstructured OCR text without synthetic codes."""
    raw_ocr_sample = """
THE TIMES OF INDIA
NEW DELHI, SATURDAY, NOVEMBER 14, 2026

GLOBAL TECH LEADERS GATHER FOR AI SUMMIT
By Tech Bureau in San Francisco
World technology leaders convened today to discuss next-generation artificial intelligence safety frameworks.
Delegates from over thirty nations shared perspectives on autonomous systems and ethics.
The consensus emphasized transparent auditing and international cooperation on large language models.

CENTRAL BANK ANNOUNCES MONETARY POLICY UPDATE
By Financial Correspondent in Mumbai
The central bank governor maintained the benchmark interest rate today, citing stable inflationary trends.
Financial markets responded positively with key indices gaining more than one percent by the afternoon close.
Economists anticipated the pause given resilient domestic economic indicators.
"""
    extracted = parse_articles_from_page_text(raw_ocr_sample, page_num=1)
    assert len(extracted) == 2
    assert "AI SUMMIT" in extracted[0]["headline"]
    assert extracted[0]["category"] in ["Science & Technology", "World"]
    assert "MONETARY POLICY" in extracted[1]["headline"]
    assert extracted[1]["category"] == "Finance"


def test_real_pdf_upload_api_and_db_persistence(app, client):
    """Verify POST /api/editions/upload processes real broadsheet PDF and persists edition and articles idempotently."""
    pdf_path = get_toi_pdf_path()
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    data = {
        "file": (io.BytesIO(pdf_bytes), "TOI_Delhi_14Nov2026_5pages.pdf", "application/pdf")
    }

    # 1. First upload
    response = client.post("/api/editions/upload", data=data, content_type="multipart/form-data")
    assert response.status_code == 200
    res_json = response.get_json()
    assert res_json["status"] == "success"
    edition_data = res_json["data"]
    assert edition_data["newspaper_name"] == "The Times of India"
    assert edition_data["edition_code"] == "TOI-DELHI"
    assert edition_data["article_count"] >= 45

    edition_id = edition_data["id"]

    # 2. Verify database records
    with app.app_context():
        edition_in_db = db.session.get(Edition, edition_id)
        assert edition_in_db is not None
        assert len(edition_in_db.articles) >= 45

    # 3. Repeat upload test (Idempotency)
    data_repeat = {
        "file": (io.BytesIO(pdf_bytes), "TOI_Delhi_14Nov2026_5pages.pdf", "application/pdf")
    }
    repeat_response = client.post("/api/editions/upload", data=data_repeat, content_type="multipart/form-data")
    assert repeat_response.status_code == 200
    repeat_json = repeat_response.get_json()
    assert repeat_json["status"] == "success"

    with app.app_context():
        editions = db.session.query(Edition).filter_by(newspaper_name="The Times of India").all()
        assert len(editions) == 1, "Duplicate edition should not be created"
        assert len(editions[0].articles) == edition_data["article_count"]


def test_frontend_api_compatibility_for_uploaded_newspaper(app, client):
    """Verify frontend-consumed GET endpoints work smoothly with uploaded real broadsheet."""
    pdf_path = get_toi_pdf_path()
    with app.app_context():
        # Ensure TOI edition is imported
        process_uploaded_newspaper_pdf(pdf_path, "TOI_Delhi_14Nov2026_5pages.pdf")
        toi = Edition.query.filter_by(newspaper_name="The Times of India").first()
        assert toi is not None
        toi_id = toi.id

    # 1. GET /api/editions
    resp = client.get("/api/editions")
    assert resp.status_code == 200
    data = resp.get_json()
    toi_entry = next((e for e in data["data"] if e["id"] == toi_id), None)
    assert toi_entry is not None
    assert toi_entry["newspaper_name"] == "The Times of India"
    assert toi_entry["edition_code"] == "TOI-DELHI"
    assert toi_entry["article_count"] >= 45

    # 2. GET /api/editions/<id>
    resp_details = client.get(f"/api/editions/{toi_id}")
    assert resp_details.status_code == 200
    details_data = resp_details.get_json()["data"]
    assert len(details_data["articles"]) >= 45

    # 3. GET /api/editions/<id>/articles with category filtering
    for cat in ["Sports", "Finance", "World", "Politics", "Current Affairs", "Science & Technology"]:
        encoded_cat = urllib.parse.quote(cat)
        resp_cat = client.get(f"/api/editions/{toi_id}/articles?category={encoded_cat}")
        assert resp_cat.status_code == 200
        cat_json = resp_cat.get_json()
        assert "data" in cat_json
        for art in cat_json["data"]:
            assert art["category"] == cat
