import uuid
from sqlalchemy import text
from sqlalchemy.dialects import postgresql
from app.models.base import db
from app.models.user import User

def test_database_basic_query(app):
    """Verify that SQLAlchemy can execute a basic query (SELECT 1)."""
    with app.app_context():
        result = db.session.execute(text("SELECT 1")).scalar()
        assert result == 1

def test_user_model_crud(app):
    """Verify SQLAlchemy model creation, insert, query, and serialization."""
    test_uuid = str(uuid.uuid4())
    with app.app_context():
        user = User(
            id=test_uuid,
            email="testuser@dailyvoice.com",
            full_name="Daily Voice Tester",
            role="reader",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()

        # Query user back
        fetched = db.session.query(User).filter_by(email="testuser@dailyvoice.com").first()
        assert fetched is not None
        assert fetched.full_name == "Daily Voice Tester"
        assert fetched.role == "reader"
        assert fetched.id == test_uuid
        assert fetched.created_at is not None

        # Test dictionary serialization
        user_dict = fetched.to_dict()
        assert user_dict["email"] == "testuser@dailyvoice.com"
        assert user_dict["id"] == test_uuid

def test_user_id_postgresql_compatibility():
    """
    CRITICAL CHECK:
    Verify that the User.id column compiles to native PostgreSQL UUID type,
    guaranteeing strict type compatibility with Supabase auth.users(id).
    """
    id_col = User.__table__.columns["id"]
    compiled_pg_type = id_col.type.compile(postgresql.dialect())
    assert compiled_pg_type.upper() == "UUID", (
        f"Expected column 'id' to compile to 'UUID' in PostgreSQL dialect, got '{compiled_pg_type}'"
    )
