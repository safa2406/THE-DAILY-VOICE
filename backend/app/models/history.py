import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import Integer, Float, Boolean, DateTime, String, Uuid, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import db

if TYPE_CHECKING:
    from .user import User
    from .article import Article
    from .edition import Edition

class ListeningHistory(db.Model):
    """
    Tracks reader audio listening progress and completion status per article.
    """
    __tablename__ = "listening_history"

    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Primary key UUID, compatible with Supabase PostgreSQL UUID",
    )
    user_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Foreign key to the User",
    )
    article_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Foreign key to the Article",
    )
    edition_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("editions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Foreign key to the Edition of the article",
    )
    listening_mode: Mapped[str] = mapped_column(
        String(32),
        default="summary",
        nullable=False,
        doc="Listening mode: summary, full, or headlines",
    )
    language: Mapped[str] = mapped_column(
        String(32),
        default="English",
        nullable=False,
        doc="Selected narration language (English, Hindi, Kannada, Telugu, Marathi)",
    )
    progress_seconds: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        doc="Current listening progress position in seconds",
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Total audio track duration in seconds",
    )
    total_listened_seconds: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        doc="Cumulative actual audio playback time in seconds across all sessions",
    )
    daily_listened_seconds: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        doc="Actual audio playback time in seconds accumulated on daily_listened_date",
    )
    daily_listened_date: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        index=True,
        doc="User local calendar date (YYYY-MM-DD) for daily_listened_seconds",
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Whether the user completed listening to the article",
    )
    last_played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="Timestamp of the most recent listening session",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_user_article_history"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="listening_history")
    article: Mapped["Article"] = relationship("Article", back_populates="listening_history")
    edition: Mapped["Edition | None"] = relationship("Edition")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id) if self.id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "article_id": str(self.article_id) if self.article_id else None,
            "edition_id": str(self.edition_id) if self.edition_id else None,
            "listening_mode": self.listening_mode,
            "language": self.language,
            "progress_seconds": self.progress_seconds,
            "duration_seconds": self.duration_seconds,
            "total_listened_seconds": self.total_listened_seconds,
            "daily_listened_seconds": self.daily_listened_seconds,
            "daily_listened_date": self.daily_listened_date,
            "is_completed": self.is_completed,
            "last_played_at": self.last_played_at.isoformat() if self.last_played_at else None,
        }

    def __repr__(self) -> str:
        return f"<ListeningHistory user={self.user_id} article={self.article_id} progress={self.progress_seconds:.1f}s completed={self.is_completed}>"
