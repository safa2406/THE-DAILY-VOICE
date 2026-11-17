import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def normalize_database_url(url: str | None) -> str:
    """
    Ensures postgresql dialect compatibility for SQLAlchemy.
    Older Supabase strings or Heroku strings starting with 'postgres://'
    must be converted to 'postgresql://'.
    If URL contains placeholder credentials (your-project-ref), fallback safely to SQLite.
    """
    if not url or "your-project-ref" in url:
        return "sqlite:///:memory:"
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    DEBUG = False
    TESTING = False

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL")
    SQLALCHEMY_DATABASE_URI = normalize_database_url(DATABASE_URL)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # CORS
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]

    # Supabase Configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Supabase Auth Strategy (Approved: asymmetric JWKS; legacy fallback: hs256)
    SUPABASE_AUTH_STRATEGY = os.getenv("SUPABASE_AUTH_STRATEGY", "jwks").lower()
    SUPABASE_JWKS_URL = os.getenv(
        "SUPABASE_JWKS_URL",
        f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""
    )
    SUPABASE_JWT_ISSUER = os.getenv(
        "SUPABASE_JWT_ISSUER",
        f"{SUPABASE_URL.rstrip('/')}/auth/v1" if SUPABASE_URL else ""
    )
    SUPABASE_JWT_AUDIENCE = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    
    # Legacy HS256 secret (only used if explicitly configured or as fallback when JWKS unavailable)
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
    
    # Supabase Storage Buckets
    STORAGE_BUCKET_AUDIO = os.getenv("SUPABASE_STORAGE_BUCKET_AUDIO", "audiobooks")
    STORAGE_BUCKET_NEWSPAPERS = os.getenv("SUPABASE_STORAGE_BUCKET_NEWSPAPERS", "newspapers")

    # Groq AI Configuration
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    DEVELOPMENT = True

    # Use a persistent local SQLite database for development when Supabase is not configured or uses placeholders
    _dev_db_url = os.getenv("DATABASE_URL")
    if not _dev_db_url or "your-project-ref" in _dev_db_url:
        _backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        _dev_db_path = os.path.join(_backend_dir, "dailyvoice_dev.db").replace("\\", "/")
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{_dev_db_path}"

    # When Supabase is not configured or uses placeholders, enable secure local HS256 JWT auth
    _supabase_url = os.getenv("SUPABASE_URL", "")
    if not _supabase_url or "your-project-ref" in _supabase_url:
        SUPABASE_AUTH_STRATEGY = "hs256"
        SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = True
    # In tests, default to SQLite in-memory if no explicit test DB provided
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    )
    SUPABASE_AUTH_STRATEGY = "hs256"
    SUPABASE_JWT_SECRET = "test-jwt-secret-key-for-unit-testing-32-chars-minimum"
    SUPABASE_JWT_AUDIENCE = "authenticated"


class ProductionConfig(BaseConfig):
    DEBUG = False
    TESTING = False


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
