import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Uuid, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import db

class Bookmark(db.Model):
    """
    Represents an article bookmarked / saved by a user for later listening.
    """
    __tablename__ = "bookmarks"

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
    saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="Timestamp when article was bookmarked",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_user_article_bookmark"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="bookmarks")
    article: Mapped["Article"] = relationship("Article", back_populates="bookmarks")

    @property
    def created_at(self) -> datetime:
        return self.saved_at

    def to_dict(self) -> dict:
        return {
            "id": str(self.id) if self.id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "article_id": str(self.article_id) if self.article_id else None,
            "saved_at": self.saved_at.isoformat() if self.saved_at else None,
        }

    def __repr__(self) -> str:
        return f"<Bookmark user={self.user_id} article={self.article_id} saved_at={self.saved_at}>"
