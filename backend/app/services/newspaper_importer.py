import os
import logging
from datetime import date
from typing import Any
import pytesseract
from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article
from app.services.pdf_extractor import extract_articles_from_pdf, extract_metadata_from_pdf

logger = logging.getLogger(__name__)

# Official 6 Sample Broadsheet Newspaper Definitions
SAMPLE_NEWSPAPERS = [
    {
        "newspaper_name": "The Times",
        "edition_code": "ED001",
        "publication_date": date(2026, 11, 7),
        "has_qr": True,
        "pdf_path": "sample_newspapers/QR/ED001_The_Times.pdf",
        "tagline": "The Independent National & International Daily • Established 1888",
        "cover_tag": "Today's Lead Edition",
        "location": "National Edition",
        "weather": "NEW DELHI 27°C SUNNY • LONDON 13°C BREEZY • NEW YORK 16°C CLEAR • BENGALURU 24°C PLEASANT",
        "headline_audio_duration": "4m 20s",
    },
    {
        "newspaper_name": "The Tribune",
        "edition_code": "ED002",
        "publication_date": date(2026, 11, 8),
        "has_qr": True,
        "pdf_path": "sample_newspapers/QR/ED002_The_Tribune.pdf",
        "tagline": "The Voice of the People • Voice of Truth and Progress",
        "cover_tag": "Sunday Edition",
        "location": "Northern Broadsheet",
        "weather": "CHANDIGARH 24°C CLEAR • JAIPUR 28°C SUNNY • CHICAGO 11°C OVERCAST • MUMBAI 30°C HUMID",
        "headline_audio_duration": "3m 50s",
    },
    {
        "newspaper_name": "The Herald",
        "edition_code": "ED003",
        "publication_date": date(2026, 11, 9),
        "has_qr": True,
        "pdf_path": "sample_newspapers/QR/ED003_The_Herald.pdf",
        "tagline": "The Southern & Global Chronicle • Inspiring Progress Daily",
        "cover_tag": "Monday Broadsheet",
        "location": "Metropolitan Edition",
        "weather": "HYDERABAD 29°C CLEAR • CHENNAI 31°C HUMID • DUBAI 32°C WARM • SINGAPORE 29°C SHOWERS",
        "headline_audio_duration": "4m 10s",
    },
    {
        "newspaper_name": "The Gazette",
        "edition_code": "ED001",
        "publication_date": date(2026, 11, 7),
        "has_qr": False,
        "pdf_path": "sample_newspapers/NoQR/ED001_The_Gazette.pdf",
        "tagline": "The Modern Broadcaster • Accurate, Comprehensive & Reliable",
        "cover_tag": "Weekend Broadsheet",
        "location": "Eastern Broadsheet",
        "weather": "KOLKATA 29°C FAIR • BHUBANESWAR 31°C WARM • PARIS 14°C CRISP • TOKYO 18°C SUNNY",
        "headline_audio_duration": "4m 00s",
    },
    {
        "newspaper_name": "The Daily Post",
        "edition_code": "ED002",
        "publication_date": date(2026, 11, 8),
        "has_qr": False,
        "pdf_path": "sample_newspapers/NoQR/ED002_The_Daily_Post.pdf",
        "tagline": "Western India's Trusted Morning Daily • Progressive Journalism",
        "cover_tag": "Sunday Morning",
        "location": "Western Broadsheet",
        "weather": "MUMBAI 30°C SUNNY • PUNE 26°C PLEASANT • LONDON 12°C CLOUDY • CHICAGO 9°C COOL",
        "headline_audio_duration": "3m 45s",
    },
    {
        "newspaper_name": "The National Standard",
        "edition_code": "ED003",
        "publication_date": date(2026, 11, 9),
        "has_qr": False,
        "pdf_path": "sample_newspapers/NoQR/ED003_The_National_Standard.pdf",
        "tagline": "The Premier Daily of Northern & Central India • Fact & Integrity",
        "cover_tag": "Archived Edition",
        "location": "National Standard Press",
        "weather": "BHOPAL 26°C CLEAR • LUCKNOW 25°C SUNNY • BERLIN 10°C CRISP • NEW YORK 15°C FAIR",
        "headline_audio_duration": "4m 15s",
    },
]


def resolve_pdf_path(rel_path: str, project_root: str | None = None) -> str:
    """Resolves project-relative PDF path safely across environments."""
    if os.path.isabs(rel_path) and os.path.exists(rel_path):
        return rel_path

    if project_root:
        candidate = os.path.join(project_root, rel_path)
        if os.path.exists(candidate):
            return candidate

    # Search standard workspace directories
    candidates = [
        rel_path,
        os.path.join(os.getcwd(), rel_path),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", rel_path)),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)

    return rel_path


def import_single_newspaper(meta: dict[str, Any], project_root: str | None = None) -> dict[str, Any]:
    """
    Imports or updates a single newspaper edition and its extracted articles idempotently.
    Uses atomic transaction management to prevent partial imports.
    """
    newspaper_name = meta["newspaper_name"]
    pub_date = meta["publication_date"]
    rel_path = meta["pdf_path"].replace("\\", "/")

    counts = {
        "edition_action": "none",
        "articles_inserted": 0,
        "articles_updated": 0,
        "articles_skipped": 0,
    }

    try:
        full_path = resolve_pdf_path(rel_path, project_root)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"PDF file for '{newspaper_name}' not found at: {full_path}")

        # Extract all articles before initiating database mutations
        extracted_articles = extract_articles_from_pdf(full_path)
        page_count = max(a["page_number"] for a in extracted_articles) if extracted_articles else 5

        # Atomic edition and articles block
        edition = (
            db.session.query(Edition)
            .filter_by(newspaper_name=newspaper_name, publication_date=pub_date)
            .first()
        )

        if not edition:
            edition = Edition(
                newspaper_name=newspaper_name,
                edition_code=meta["edition_code"],
                publication_date=pub_date,
                location=meta.get("location"),
                weather=meta.get("weather"),
                page_count=page_count,
                pdf_path=rel_path,
                has_qr=meta.get("has_qr", False),
                tagline=meta.get("tagline"),
                cover_tag=meta.get("cover_tag"),
                headline_audio_duration=meta.get("headline_audio_duration"),
            )
            db.session.add(edition)
            counts["edition_action"] = "inserted"
        else:
            edition.edition_code = meta["edition_code"]
            edition.page_count = page_count
            edition.pdf_path = rel_path
            edition.has_qr = meta.get("has_qr", False)
            edition.location = meta.get("location")
            edition.weather = meta.get("weather")
            edition.tagline = meta.get("tagline")
            edition.cover_tag = meta.get("cover_tag")
            edition.headline_audio_duration = meta.get("headline_audio_duration")
            counts["edition_action"] = "updated"

        db.session.flush()

        # Existing articles mapped by article_code, kicker, and headline for stable matching
        existing_by_code = {}
        existing_by_kicker = {}
        existing_by_headline = {}
        for art in db.session.query(Article).filter_by(edition_id=edition.id).all():
            if art.article_code:
                existing_by_code[art.article_code] = art
            if art.kicker:
                existing_by_kicker[art.kicker] = art
            if art.headline:
                existing_by_headline[art.headline.strip().lower()] = art

        for item in extracted_articles:
            kicker = item.get("kicker")
            if kicker:
                kicker = kicker[:250]
            code = item.get("code")
            headline = item["headline"][:490]
            byline = item.get("byline")
            if byline:
                byline = byline[:250]
            category = item.get("category", "Current Affairs")
            if category not in ("Current Affairs", "World", "Sports", "Finance", "Science & Technology", "Politics"):
                category = "Current Affairs"

            existing = (
                (existing_by_code.get(code) if code else None)
                or (existing_by_kicker.get(kicker) if kicker else None)
                or existing_by_headline.get(headline.strip().lower())
            )
            if existing:
                # Check if meaningful update needed
                changed = (
                    existing.headline != headline
                    or existing.content != item["content"]
                    or existing.byline != byline
                    or existing.page_number != item["page_number"]
                    or existing.category != category
                )
                if changed:
                    existing.headline = headline
                    existing.byline = byline
                    existing.page_number = item["page_number"]
                    existing.category = category
                    existing.summary = item["summary"]
                    existing.content = item["content"]
                    existing.duration_seconds = item["duration_seconds"]
                    existing.is_headline = item["is_headline"]
                    counts["articles_updated"] += 1
                else:
                    counts["articles_skipped"] += 1
            else:
                new_art = Article(
                    edition_id=edition.id,
                    kicker=kicker,
                    headline=headline,
                    byline=byline,
                    page_number=item["page_number"],
                    category=category,
                    summary=item["summary"],
                    content=item["content"],
                    duration_seconds=item["duration_seconds"],
                    is_headline=item["is_headline"],
                )
                db.session.add(new_art)
                counts["articles_inserted"] += 1

        db.session.commit()
        return {
            "newspaper": newspaper_name,
            "edition_code": meta["edition_code"],
            "publication_date": str(pub_date),
            "status": "success",
            "edition_id": edition.id,
            "total_articles": len(extracted_articles),
            **counts,
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to import newspaper '{newspaper_name}': {e}")
        return {
            "newspaper": newspaper_name,
            "edition_code": meta["edition_code"],
            "publication_date": str(pub_date),
            "status": "failed",
            "error": str(e),
            **counts,
        }


def import_all_sample_newspapers(project_root: str | None = None) -> dict[str, Any]:
    """
    Imports all six registered sample newspaper publications into the database.
    Idempotent: Safe to execute repeatedly without duplicating records.
    """
    summary = {
        "editions_inserted": 0,
        "editions_updated": 0,
        "editions_failed": 0,
        "articles_inserted": 0,
        "articles_updated": 0,
        "articles_skipped": 0,
        "total_editions_processed": 0,
        "total_articles_extracted": 0,
        "results": [],
    }

    for meta in SAMPLE_NEWSPAPERS:
        res = import_single_newspaper(meta, project_root=project_root)
        summary["results"].append(res)
        summary["total_editions_processed"] += 1

        if res["status"] == "success":
            summary["total_articles_extracted"] += res.get("total_articles", 0)
            if res["edition_action"] == "inserted":
                summary["editions_inserted"] += 1
            elif res["edition_action"] == "updated":
                summary["editions_updated"] += 1

            summary["articles_inserted"] += res.get("articles_inserted", 0)
            summary["articles_updated"] += res.get("articles_updated", 0)
            summary["articles_skipped"] += res.get("articles_skipped", 0)
        else:
            summary["editions_failed"] += 1

    return summary


def process_uploaded_newspaper_pdf(pdf_path: str, filename: str = "") -> dict[str, Any]:
    """
    Parses an uploaded newspaper PDF, extracts metadata and articles,
    and creates or updates the Edition and Article database records atomically.
    Returns a dict with success status and the Edition model instance.
    """
    try:
        if not os.path.exists(pdf_path):
            return {"success": False, "error": f"Uploaded file not found on disk at: {pdf_path}"}

        # 1. Extract metadata and articles
        meta = extract_metadata_from_pdf(pdf_path, filename=filename)
        articles = extract_articles_from_pdf(pdf_path)

        if not articles:
            return {"success": False, "error": "No individual articles could be extracted from the uploaded PDF."}

        # 2. Database transaction: match existing edition to prevent duplicates
        newspaper_name = meta["newspaper_name"]
        pub_date = meta["publication_date"]

        edition = (
            db.session.query(Edition)
            .filter_by(newspaper_name=newspaper_name, publication_date=pub_date)
            .first()
        )

        page_count = meta.get("page_count") or (max(a["page_number"] for a in articles) if articles else 5)
        rel_pdf_path = pdf_path.replace("\\", "/")

        if not edition:
            edition = Edition(
                newspaper_name=newspaper_name,
                edition_code=meta["edition_code"],
                publication_date=pub_date,
                location=meta.get("location"),
                weather=meta.get("weather"),
                page_count=page_count,
                pdf_path=rel_pdf_path,
                has_qr=meta.get("has_qr", False),
                tagline=meta.get("tagline"),
                cover_tag=meta.get("cover_tag"),
                headline_audio_duration=meta.get("headline_audio_duration"),
            )
            db.session.add(edition)
        else:
            edition.edition_code = meta["edition_code"]
            edition.page_count = page_count
            edition.pdf_path = rel_pdf_path
            edition.has_qr = meta.get("has_qr", False)
            if meta.get("location"):
                edition.location = meta.get("location")
            if meta.get("weather"):
                edition.weather = meta.get("weather")
            if meta.get("tagline"):
                edition.tagline = meta.get("tagline")
            if meta.get("cover_tag"):
                edition.cover_tag = meta.get("cover_tag")
            if meta.get("headline_audio_duration"):
                edition.headline_audio_duration = meta.get("headline_audio_duration")

        db.session.flush()

        # Existing articles mapped by article_code, kicker, and headline for stable matching
        existing_by_code = {}
        existing_by_kicker = {}
        existing_by_headline = {}
        for art in db.session.query(Article).filter_by(edition_id=edition.id).all():
            if art.article_code:
                existing_by_code[art.article_code] = art
            if art.kicker:
                existing_by_kicker[art.kicker] = art
            if art.headline:
                existing_by_headline[art.headline.strip().lower()] = art

        for item in articles:
            kicker = item.get("kicker")
            if kicker:
                kicker = kicker[:250]
            code = item.get("code")
            headline = item["headline"][:490]
            byline = item.get("byline")
            if byline:
                byline = byline[:250]
            category = item.get("category", "Current Affairs")
            if category not in ("Current Affairs", "World", "Sports", "Finance", "Science & Technology", "Politics"):
                category = "Current Affairs"

            existing = (
                (existing_by_code.get(code) if code else None)
                or (existing_by_kicker.get(kicker) if kicker else None)
                or existing_by_headline.get(headline.strip().lower())
            )
            if existing:
                existing.headline = headline
                existing.byline = byline
                existing.page_number = item["page_number"]
                existing.category = category
                existing.summary = item["summary"]
                existing.content = item["content"]
                existing.duration_seconds = item["duration_seconds"]
                existing.is_headline = item["is_headline"]
            else:
                new_art = Article(
                    edition_id=edition.id,
                    kicker=kicker,
                    headline=headline,
                    byline=byline,
                    page_number=item["page_number"],
                    category=category,
                    summary=item["summary"],
                    content=item["content"],
                    duration_seconds=item["duration_seconds"],
                    is_headline=item["is_headline"],
                )
                db.session.add(new_art)

        db.session.commit()
        return {"success": True, "edition": edition, "articles": articles}

    except pytesseract.TesseractNotFoundError as e:
        db.session.rollback()
        logger.error(f"Tesseract OCR not installed or configured: {e}")
        return {
            "success": False,
            "error": (
                "Scanned or image-only PDF detected, but Tesseract OCR engine is not installed or configured on the server. "
                "Please install Tesseract-OCR to enable scanned PDF processing."
            ),
        }
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error processing uploaded newspaper PDF: {e}")
        return {"success": False, "error": str(e)}
