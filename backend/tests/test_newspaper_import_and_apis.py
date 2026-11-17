import uuid
import pytest
from datetime import date
from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article, VALID_CATEGORIES
from app.services.newspaper_importer import (
    import_all_sample_newspapers,
    import_single_newspaper,
    SAMPLE_NEWSPAPERS,
)

@pytest.fixture(autouse=True)
def setup_newspaper_data(app):
    """Imports all six newspapers before each test in this module."""
    with app.app_context():
        import_all_sample_newspapers()
        yield


def test_import_all_six_pdfs_and_counts(app):
    """Verify that all six sample PDFs are imported with exactly 20 articles each (120 total)."""
    with app.app_context():
        editions = db.session.query(Edition).all()
        assert len(editions) == 6, f"Expected 6 editions, found {len(editions)}"

        total_articles = db.session.query(Article).count()
        assert total_articles == 120, f"Expected 120 articles, found {total_articles}"

        for ed in editions:
            art_count = db.session.query(Article).filter_by(edition_id=ed.id).count()
            assert art_count == 20, f"Edition {ed.newspaper_name} has {art_count} articles, expected 20"


def test_edition_metadata_and_qr_classification(app):
    """Verify exact metadata from Section 4 table, QR vs NoQR classification, and relative paths."""
    expected_table = {
        ("The Times", "ED001"): {"date": date(2026, 11, 7), "has_qr": True, "path_dir": "QR"},
        ("The Tribune", "ED002"): {"date": date(2026, 11, 8), "has_qr": True, "path_dir": "QR"},
        ("The Herald", "ED003"): {"date": date(2026, 11, 9), "has_qr": True, "path_dir": "QR"},
        ("The Gazette", "ED001"): {"date": date(2026, 11, 7), "has_qr": False, "path_dir": "NoQR"},
        ("The Daily Post", "ED002"): {"date": date(2026, 11, 8), "has_qr": False, "path_dir": "NoQR"},
        ("The National Standard", "ED003"): {"date": date(2026, 11, 9), "has_qr": False, "path_dir": "NoQR"},
    }

    with app.app_context():
        editions = db.session.query(Edition).all()
        assert len(editions) == 6

        found_keys = set()
        for ed in editions:
            key = (ed.newspaper_name, ed.edition_code)
            assert key in expected_table, f"Unexpected edition: {key}"
            found_keys.add(key)

            expected = expected_table[key]
            assert ed.publication_date == expected["date"]
            assert ed.has_qr is expected["has_qr"]
            assert ed.page_count == 5

            # Relative path check (no local absolute paths)
            assert not ed.pdf_path.startswith("C:")
            assert not ed.pdf_path.startswith("/")
            assert expected["path_dir"] in ed.pdf_path
            assert ed.pdf_path.endswith(".pdf")

        assert found_keys == set(expected_table.keys())


def test_article_content_extraction_quality(app):
    """Verify article fields: headline, byline, page number, categories, article_code, and word count."""
    import re
    with app.app_context():
        articles = db.session.query(Article).all()
        assert len(articles) == 120

        unique_codes = set()
        categories_found = set()

        for art in articles:
            # Code and kicker
            assert art.kicker and len(art.kicker) > 5
            assert art.article_code is not None, f"Article {art.id} missing article_code"
            assert re.match(r'^[A-Z]{2}-[A-Z]{2}-\d{3}$', art.article_code), (
                f"Invalid article_code format: {art.article_code}"
            )
            assert art.article_code in art.kicker
            unique_codes.add(art.article_code)

            # Headline
            assert art.headline and len(art.headline) > 10
            # Byline
            assert art.byline.startswith("By "), f"Invalid byline: {art.byline}"
            assert " in " in art.byline, f"Location missing in byline: {art.byline}"
            # Page number
            assert 1 <= art.page_number <= 5
            # Category validation
            assert art.category in VALID_CATEGORIES
            categories_found.add(art.category)
            # Content & summary
            assert len(art.content) > 100, f"Content too short in {art.kicker}"
            assert len(art.summary) > 20, f"Summary too short in {art.kicker}"
            # Clean text: no running headers or footers
            assert "PAGE " not in art.content
            assert "THE DAILY VOICE PRINT EDITION" not in art.content
            assert "★" not in art.content
            # Duration
            assert art.duration_seconds >= 45

            # Lead story headline indicator
            if art.page_number == 1:
                assert art.is_headline is True
            else:
                assert art.is_headline is False

        # All 120 article codes must be unique
        assert len(unique_codes) == 120
        # All 6 approved categories must be represented
        assert categories_found == set(VALID_CATEGORIES)


def test_political_category_classification(app):
    """Verify refined classification of genuinely political legislation vs executive initiatives."""
    with app.app_context():
        # US Congress AI safety legislation -> Politics
        tg_ca_002 = db.session.query(Article).filter(Article.kicker.like("%TG-CA-002%")).first()
        assert tg_ca_002 is not None
        assert tg_ca_002.article_code == "TG-CA-002"
        assert tg_ca_002.category == "Politics"

        # British Parliament regional transit act -> Politics
        tt_wn_001 = db.session.query(Article).filter(Article.kicker.like("%TT-WN-001%")).first()
        assert tt_wn_001 is not None
        assert tt_wn_001.article_code == "TT-WN-001"
        assert tt_wn_001.category == "Politics"

        # Prime Minister clean-energy district initiative -> Current Affairs
        ns_ca_001 = db.session.query(Article).filter(Article.kicker.like("%NS-CA-001%")).first()
        assert ns_ca_001 is not None
        assert ns_ca_001.article_code == "NS-CA-001"
        assert ns_ca_001.category == "Current Affairs"


def test_api_list_editions(client):
    """Test GET /api/editions endpoint."""
    resp = client.get("/api/editions")
    assert resp.status_code == 200
    payload = resp.get_json()

    assert payload["status"] == "success"
    assert payload["count"] == 6
    assert len(payload["data"]) == 6

    for ed in payload["data"]:
        assert "id" in ed
        assert "newspaper_name" in ed
        assert "edition_code" in ed
        assert "publication_date" in ed
        assert "page_count" in ed
        assert "has_qr" in ed
        assert ed["article_count"] == 20


def test_api_get_edition_details(client, app):
    """Test GET /api/editions/<edition_id> endpoint."""
    with app.app_context():
        edition = db.session.query(Edition).filter_by(newspaper_name="The Times").first()
        edition_id = str(edition.id)

    resp = client.get(f"/api/editions/{edition_id}")
    assert resp.status_code == 200
    payload = resp.get_json()

    assert payload["status"] == "success"
    ed_data = payload["data"]
    assert ed_data["id"] == edition_id
    assert ed_data["newspaper_name"] == "The Times"
    assert ed_data["article_count"] == 20
    assert len(ed_data["articles"]) == 20

    first_article = ed_data["articles"][0]
    assert first_article["page_number"] == 1
    assert first_article["category"] == "Current Affairs"
    assert "headline" in first_article
    assert "byline" in first_article
    assert "content" in first_article


def test_api_get_edition_articles_and_filtering(client, app):
    """Test GET /api/editions/<edition_id>/articles with and without category filter."""
    with app.app_context():
        edition = db.session.query(Edition).filter_by(newspaper_name="The Times").first()
        edition_id = str(edition.id)

    # 1. Without filter: returns all 20 articles
    resp_all = client.get(f"/api/editions/{edition_id}/articles")
    assert resp_all.status_code == 200
    payload_all = resp_all.get_json()
    assert payload_all["count"] == 20
    for a in payload_all["data"]:
        assert "article_code" in a
        assert a["article_code"] is not None

    # 2. Category filter: World (exact match) - returns 3 articles in The Times (TT-WN-001 classified as Politics)
    resp_world = client.get(f"/api/editions/{edition_id}/articles?category=World")
    assert resp_world.status_code == 200
    payload_world = resp_world.get_json()
    assert payload_world["count"] == 3
    for a in payload_world["data"]:
        assert a["category"] == "World"
        assert a["page_number"] == 2

    # 3. Category filter: Politics (exact match) - returns TT-WN-001 in The Times
    resp_pol = client.get(f"/api/editions/{edition_id}/articles?category=Politics")
    assert resp_pol.status_code == 200
    payload_pol = resp_pol.get_json()
    assert payload_pol["count"] == 1
    assert payload_pol["data"][0]["article_code"] == "TT-WN-001"
    assert payload_pol["data"][0]["category"] == "Politics"

    # 4. Category filter: case-insensitive (e.g. 'finance')
    resp_fin = client.get(f"/api/editions/{edition_id}/articles?category=finance")
    assert resp_fin.status_code == 200
    payload_fin = resp_fin.get_json()
    assert payload_fin["count"] == 4
    for a in payload_fin["data"]:
        assert a["category"] == "Finance"
        assert a["page_number"] == 3

    # 5. Non-matching category
    resp_none = client.get(f"/api/editions/{edition_id}/articles?category=NonExistent")
    assert resp_none.status_code == 200
    payload_none = resp_none.get_json()
    assert payload_none["count"] == 0
    assert payload_none["data"] == []


def test_api_get_individual_article(client, app):
    """Test GET /api/articles/<article_id> endpoint with UUID and article_code."""
    with app.app_context():
        article = db.session.query(Article).first()
        art_id = str(article.id)
        art_code = article.article_code
        expected_headline = article.headline

    # By UUID
    resp = client.get(f"/api/articles/{art_id}")
    assert resp.status_code == 200
    payload = resp.get_json()

    assert payload["status"] == "success"
    data = payload["data"]
    assert data["id"] == art_id
    assert data["article_code"] == art_code
    assert data["headline"] == expected_headline
    assert "newspaper_name" in data
    assert "edition_code" in data
    assert "publication_date" in data
    assert "content" in data
    assert "byline" in data

    # By article code
    resp_code = client.get(f"/api/articles/{art_code}")
    assert resp_code.status_code == 200
    data_code = resp_code.get_json()["data"]
    assert data_code["id"] == art_id
    assert data_code["article_code"] == art_code


def test_api_invalid_ids_return_404(client):
    """Test that non-existent edition and article IDs return structured 404."""
    random_id = str(uuid.uuid4())

    # Invalid edition details
    r1 = client.get(f"/api/editions/{random_id}")
    assert r1.status_code == 404
    p1 = r1.get_json()
    assert p1["status"] == "error"
    assert p1["code"] == "NOT_FOUND"

    # Invalid edition articles
    r2 = client.get(f"/api/editions/{random_id}/articles")
    assert r2.status_code == 404
    p2 = r2.get_json()
    assert p2["status"] == "error"
    assert p2["code"] == "NOT_FOUND"

    # Invalid article
    r3 = client.get(f"/api/articles/{random_id}")
    assert r3.status_code == 404
    p3 = r3.get_json()
    assert p3["status"] == "error"
    assert p3["code"] == "NOT_FOUND"


def test_repeated_import_idempotency_no_duplicates(app):
    """Verify that executing import_all_sample_newspapers multiple times creates zero duplicate rows."""
    with app.app_context():
        # Already imported by fixture once
        initial_editions = db.session.query(Edition).count()
        initial_articles = db.session.query(Article).count()
        assert initial_editions == 6
        assert initial_articles == 120

        # Execute second import run
        summary2 = import_all_sample_newspapers()
        assert summary2["editions_inserted"] == 0
        assert summary2["editions_updated"] == 6
        assert summary2["articles_inserted"] == 0
        assert summary2["articles_skipped"] == 120

        # Verify database totals unchanged
        after_editions = db.session.query(Edition).count()
        after_articles = db.session.query(Article).count()
        assert after_editions == 6
        assert after_articles == 120


def test_import_transaction_rollback_on_failure(app):
    """Verify that importing an invalid file rolls back safely without committing corrupted data."""
    invalid_meta = {
        "newspaper_name": "NonExistent Paper",
        "edition_code": "ED999",
        "publication_date": date(2026, 12, 1),
        "pdf_path": "sample_newspapers/QR/non_existent_file.pdf",
    }

    with app.app_context():
        count_before = db.session.query(Edition).count()
        res = import_single_newspaper(invalid_meta)

        assert res["status"] == "failed"
        assert "not found" in res["error"].lower()

        count_after = db.session.query(Edition).count()
        assert count_after == count_before
