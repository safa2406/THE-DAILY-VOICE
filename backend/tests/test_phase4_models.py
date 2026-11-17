import uuid
import pytest
from datetime import date, datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects import postgresql
from app.models.base import db
from app.models.user import User
from app.models.edition import Edition
from app.models.article import Article, VALID_CATEGORIES
from app.models.history import ListeningHistory
from app.models.bookmark import Bookmark

def create_sample_user(email="reader@dailyvoice.com", full_name="Safa Reader"):
    return User(
        id=str(uuid.uuid4()),
        email=email,
        full_name=full_name,
        role="reader",
        is_active=True,
    )

def create_sample_edition(
    code="ED001",
    name="The Times",
    pub_date=date(2026, 11, 7),
    has_qr=True,
):
    return Edition(
        id=str(uuid.uuid4()),
        edition_code=code,
        newspaper_name=name,
        publication_date=pub_date,
        location="National Edition",
        weather="18°C Mild & Breezy",
        page_count=5,
        pdf_path="sample_newspapers/QR/ED001_The_Times.pdf",
        has_qr=has_qr,
        tagline="The Independent Journal of Record Since 1888",
        cover_tag="Today's Lead Edition",
        headline_audio_duration="4m 20s",
    )

def test_edition_model_crud(app):
    """Verify Edition model creation, persistence, query, and serialization."""
    with app.app_context():
        edition = create_sample_edition()
        edition_id = edition.id
        db.session.add(edition)
        db.session.commit()

        # Query back
        fetched = db.session.query(Edition).filter_by(id=edition_id).first()
        assert fetched is not None
        assert fetched.edition_code == "ED001"
        assert fetched.newspaper_name == "The Times"
        assert fetched.publication_date == date(2026, 11, 7)
        assert fetched.has_qr is True
        assert fetched.page_count == 5
        assert fetched.created_at is not None
        assert fetched.updated_at is not None

        # Test to_dict serialization
        data = fetched.to_dict()
        assert data["id"] == edition_id
        assert data["edition_code"] == "ED001"
        assert data["publication_date"] == "2026-11-07"
        assert data["has_qr"] is True

def test_article_model_crud_and_valid_categories(app):
    """Verify Article creation, category validation, and properties."""
    with app.app_context():
        edition = create_sample_edition()
        db.session.add(edition)
        db.session.commit()

        # Create one article for each of the 6 approved categories
        for page_idx, cat in enumerate(VALID_CATEGORIES, start=1):
            art = Article(
                id=str(uuid.uuid4()),
                edition_id=edition.id,
                category=cat,
                kicker=f"TOPIC {cat.upper()} SEC-{page_idx}",
                headline=f"Headline Story for {cat}",
                byline="By Staff Reporter in New Delhi",
                page_number=page_idx,
                summary=f"Summary of {cat} article.",
                content=f"Detailed body paragraphs for {cat} story reporting.",
                duration_seconds=180 + page_idx * 20,
                is_headline=(page_idx == 1),
                audio_url=f"/audio/{cat.lower().replace(' ', '_')}.mp3",
            )
            db.session.add(art)
        db.session.commit()

        # Query articles
        articles = db.session.query(Article).filter_by(edition_id=edition.id).all()
        assert len(articles) == len(VALID_CATEGORIES)
        categories_found = {a.category for a in articles}
        assert categories_found == set(VALID_CATEGORIES)

        # Check title alias
        lead = articles[0]
        assert lead.title == lead.headline
        lead.title = "Updated Headline Title"
        assert lead.headline == "Updated Headline Title"

        # Check serialization
        art_dict = lead.to_dict()
        assert art_dict["category"] == lead.category
        assert art_dict["headline"] == "Updated Headline Title"
        assert art_dict["title"] == "Updated Headline Title"

def test_article_invalid_category_rejection(app):
    """Verify that assigning an unapproved category raises ValueError."""
    with app.app_context():
        edition = create_sample_edition()
        db.session.add(edition)
        db.session.commit()

        with pytest.raises(ValueError, match="Invalid category"):
            Article(
                id=str(uuid.uuid4()),
                edition_id=edition.id,
                category="Entertainment Gossip",  # Unapproved category
                headline="Celebrity News",
                content="Body text...",
            )

def test_edition_articles_relationship_and_cascade(app):
    """Verify Edition -> Articles relationship ordering and cascade deletion."""
    with app.app_context():
        edition = create_sample_edition()
        db.session.add(edition)
        db.session.commit()

        # Add articles out of page order
        art_p3 = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="Finance",
            headline="Market Story",
            content="Content...",
            page_number=3,
        )
        art_p1 = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="Current Affairs",
            headline="Front Page Story",
            content="Content...",
            page_number=1,
            is_headline=True,
        )
        art_p2 = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="World",
            headline="Global Story",
            content="Content...",
            page_number=2,
        )
        db.session.add_all([art_p3, art_p1, art_p2])
        db.session.commit()

        # Refresh edition and verify ordering by page_number
        db.session.refresh(edition)
        assert len(edition.articles) == 3
        assert [a.page_number for a in edition.articles] == [1, 2, 3]
        assert edition.articles[0].headline == "Front Page Story"

        # Verify back_populates
        assert art_p1.edition.newspaper_name == edition.newspaper_name

        # Test cascade delete: deleting edition removes all articles
        db.session.delete(edition)
        db.session.commit()

        remaining_articles = db.session.query(Article).all()
        assert len(remaining_articles) == 0

def test_listening_history_crud_and_relationship(app):
    """Verify ListeningHistory progress tracking, completion, and relationship."""
    with app.app_context():
        user = create_sample_user()
        edition = create_sample_edition()
        db.session.add_all([user, edition])
        db.session.commit()

        article = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="Science & Technology",
            headline="Quantum Sensor Deployed",
            content="Article body...",
            duration_seconds=300,
        )
        db.session.add(article)
        db.session.commit()

        # Record initial progress
        history = ListeningHistory(
            id=str(uuid.uuid4()),
            user_id=user.id,
            article_id=article.id,
            progress_seconds=75.5,
            duration_seconds=300,
            is_completed=False,
        )
        db.session.add(history)
        db.session.commit()

        # Check relationships
        db.session.refresh(user)
        db.session.refresh(article)
        assert len(user.listening_history) == 1
        assert user.listening_history[0].progress_seconds == 75.5
        assert article.listening_history[0].user_id == user.id

        # Update progress to completion
        history.progress_seconds = 300.0
        history.is_completed = True
        db.session.commit()

        updated = db.session.query(ListeningHistory).filter_by(id=history.id).first()
        assert updated.is_completed is True
        assert updated.progress_seconds == 300.0

        # Test serialization
        hist_dict = updated.to_dict()
        assert hist_dict["user_id"] == user.id
        assert hist_dict["article_id"] == article.id
        assert hist_dict["is_completed"] is True

def test_listening_history_duplicate_prevention(app):
    """Verify unique constraint prevents duplicate history entries for same (user, article)."""
    with app.app_context():
        user = create_sample_user()
        edition = create_sample_edition()
        db.session.add_all([user, edition])
        db.session.commit()

        article = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="Sports",
            headline="Championship Final",
            content="Content...",
            duration_seconds=200,
        )
        db.session.add(article)
        db.session.commit()

        h1 = ListeningHistory(
            id=str(uuid.uuid4()),
            user_id=user.id,
            article_id=article.id,
            progress_seconds=10.0,
            duration_seconds=200,
        )
        db.session.add(h1)
        db.session.commit()

        # Attempt to insert second entry for same user and article
        h2 = ListeningHistory(
            id=str(uuid.uuid4()),
            user_id=user.id,
            article_id=article.id,
            progress_seconds=50.0,
            duration_seconds=200,
        )
        db.session.add(h2)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

def test_bookmark_crud_and_relationship(app):
    """Verify Bookmark model creation, user/article relationships, and serialization."""
    with app.app_context():
        user = create_sample_user()
        edition = create_sample_edition()
        db.session.add_all([user, edition])
        db.session.commit()

        article = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="Politics",
            headline="Clean Transit Legislation Passes",
            content="Content...",
            duration_seconds=240,
        )
        db.session.add(article)
        db.session.commit()

        bookmark = Bookmark(
            id=str(uuid.uuid4()),
            user_id=user.id,
            article_id=article.id,
        )
        db.session.add(bookmark)
        db.session.commit()

        # Check relationships
        db.session.refresh(user)
        db.session.refresh(article)
        assert len(user.bookmarks) == 1
        assert user.bookmarks[0].article_id == article.id
        assert article.bookmarks[0].user_id == user.id

        # Check serialization
        bm_dict = bookmark.to_dict()
        assert bm_dict["user_id"] == user.id
        assert bm_dict["article_id"] == article.id
        assert bm_dict["saved_at"] is not None

def test_bookmark_duplicate_prevention(app):
    """Verify unique constraint prevents duplicate bookmarks for same (user, article)."""
    with app.app_context():
        user = create_sample_user()
        edition = create_sample_edition()
        db.session.add_all([user, edition])
        db.session.commit()

        article = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="World",
            headline="International Climate Accord",
            content="Content...",
            duration_seconds=180,
        )
        db.session.add(article)
        db.session.commit()

        bm1 = Bookmark(
            id=str(uuid.uuid4()),
            user_id=user.id,
            article_id=article.id,
        )
        db.session.add(bm1)
        db.session.commit()

        # Duplicate bookmark attempt
        bm2 = Bookmark(
            id=str(uuid.uuid4()),
            user_id=user.id,
            article_id=article.id,
        )
        db.session.add(bm2)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

def test_foreign_key_constraints_enforced(app):
    """Verify that foreign key constraints reject records pointing to non-existent parents."""
    with app.app_context():
        non_existent_id = str(uuid.uuid4())

        # 1. Article with non-existent edition
        orphan_article = Article(
            id=str(uuid.uuid4()),
            edition_id=non_existent_id,
            category="Current Affairs",
            headline="Orphan Story",
            content="Content...",
        )
        db.session.add(orphan_article)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

        # 2. Bookmark with non-existent user
        user = create_sample_user()
        edition = create_sample_edition()
        db.session.add_all([user, edition])
        db.session.commit()

        article = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="Current Affairs",
            headline="Valid Article",
            content="Content...",
        )
        db.session.add(article)
        db.session.commit()

        orphan_bookmark = Bookmark(
            id=str(uuid.uuid4()),
            user_id=non_existent_id,
            article_id=article.id,
        )
        db.session.add(orphan_bookmark)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

        # 3. ListeningHistory with non-existent article
        orphan_history = ListeningHistory(
            id=str(uuid.uuid4()),
            user_id=user.id,
            article_id=non_existent_id,
            progress_seconds=10.0,
            duration_seconds=100,
        )
        db.session.add(orphan_history)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

def test_postgresql_uuid_compatibility_phase4_models():
    """
    CRITICAL CHECK:
    Verify that all Phase 4 model ID and foreign key columns compile to native
    PostgreSQL UUID type, ensuring strict compatibility with Supabase PostgreSQL.
    """
    columns_to_verify = [
        (Edition, "id"),
        (Article, "id"),
        (Article, "edition_id"),
        (ListeningHistory, "id"),
        (ListeningHistory, "user_id"),
        (ListeningHistory, "article_id"),
        (Bookmark, "id"),
        (Bookmark, "user_id"),
        (Bookmark, "article_id"),
    ]

    pg_dialect = postgresql.dialect()
    for model, col_name in columns_to_verify:
        col = model.__table__.columns[col_name]
        compiled = col.type.compile(pg_dialect)
        assert compiled.upper() == "UUID", (
            f"Expected {model.__name__}.{col_name} to compile to 'UUID' in PostgreSQL dialect, got '{compiled}'"
        )
