import os
from app.config.config import (
    BaseConfig,
    DevelopmentConfig,
    TestingConfig,
    ProductionConfig,
    normalize_database_url,
)

def test_normalize_database_url():
    """Verify that postgres:// URLs are converted to postgresql:// for SQLAlchemy."""
    assert normalize_database_url("postgres://user:pass@host:5432/db") == "postgresql://user:pass@host:5432/db"
    assert normalize_database_url("postgresql://user:pass@host:5432/db") == "postgresql://user:pass@host:5432/db"
    assert normalize_database_url(None) == "sqlite:///:memory:"

def test_development_config():
    """Verify DevelopmentConfig settings."""
    assert DevelopmentConfig.DEBUG is True
    assert DevelopmentConfig.TESTING is False

def test_testing_config():
    """Verify TestingConfig settings."""
    assert TestingConfig.TESTING is True
    assert TestingConfig.DEBUG is True
    assert "sqlite" in TestingConfig.SQLALCHEMY_DATABASE_URI

def test_production_config():
    """Verify ProductionConfig settings."""
    assert ProductionConfig.DEBUG is False
    assert ProductionConfig.TESTING is False

def test_cors_origins_parsing():
    """Verify CORS origins parsing splits comma-separated strings."""
    assert isinstance(BaseConfig.CORS_ORIGINS, list)
    assert len(BaseConfig.CORS_ORIGINS) >= 1
