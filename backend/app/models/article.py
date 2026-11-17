import re
import uuid
from sqlalchemy import String, Integer, Boolean, Text, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from .base import db, TimestampMixin

VALID_CATEGORIES = (
    "Current Affairs",
    "World",
    "Sports",
    "Finance",
    "Science & Technology",
    "Politics",
)

class Article(TimestampMixin, db.Model):
    """
    Represents an extracted newspaper article belonging to an Edition.
    """
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Primary key UUID, compatible with Supabase PostgreSQL UUID",
    )
    edition_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("editions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Foreign key to the parent Edition",
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="One of the 6 approved editorial desks/categories",
    )
    kicker: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Topic kicker / article code (e.g. WESTMINSTER LEGISLATION TT-WN-001)",
    )
    headline: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        doc="Article headline title",
    )
    byline: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Author byline and location attribution",
    )
    page_number: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        index=True,
        doc="Broadsheet page number where article appeared (1 to 5)",
    )
    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Brief summary or lead paragraph for headlines digest",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Full article body paragraphs",
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Estimated or actual audio duration in seconds",
    )
    is_headline: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        doc="Indicates if the story is a front-page lead headline",
    )
    audio_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        doc="Storage path or URL to narrated audio track",
    )

    # Relationships
    edition: Mapped["Edition"] = relationship("Edition", back_populates="articles")
    listening_history: Mapped[list["ListeningHistory"]] = relationship(
        "ListeningHistory",
        back_populates="article",
        cascade="all, delete-orphan",
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        "Bookmark",
        back_populates="article",
        cascade="all, delete-orphan",
    )

    @validates("category")
    def validate_category(self, key, value):
        if value not in VALID_CATEGORIES:
            raise ValueError(
                f"Invalid category '{value}'. Must be one of: {', '.join(VALID_CATEGORIES)}"
            )
        return value

    @property
    def article_code(self) -> str | None:
        """Extracts the unique article code (e.g. TT-WN-001) from the kicker."""
        if not self.kicker:
            return None
        match = re.search(r'([A-Z]{2}-[A-Z]{2}-\d{3})', self.kicker)
        return match.group(1) if match else None

    @article_code.setter
    def article_code(self, value: str | None):
        """Allows assigning article_code without breaking if passed in constructors."""
        if value and not self.kicker:
            self.kicker = value
        elif value and self.kicker and not re.search(r'[A-Z]{2}-[A-Z]{2}-\d{3}', self.kicker):
            self.kicker = f"{self.kicker} {value}".strip()

    @property
    def title(self) -> str:
        """Alias for headline to support both property names seamlessly."""
        return self.headline

    @title.setter
    def title(self, value: str):
        self.headline = value

    def to_dict(self) -> dict:
        return {
            "id": str(self.id) if self.id else None,
            "edition_id": str(self.edition_id) if self.edition_id else None,
            "article_code": self.article_code,
            "category": self.category,
            "kicker": self.kicker,
            "headline": self.headline,
            "title": self.headline,
            "byline": self.byline,
            "page_number": self.page_number,
            "summary": self.summary,
            "content": self.content,
            "duration_seconds": self.duration_seconds,
            "is_headline": self.is_headline,
            "audio_url": self.audio_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Article '{self.headline[:30]}...' ({self.category}) - Page {self.page_number}>"
