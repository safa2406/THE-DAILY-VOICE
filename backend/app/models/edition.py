import uuid
from datetime import date
from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, Boolean, Date, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import db, TimestampMixin

if TYPE_CHECKING:
    from .user_edition import UserEdition
    from .article import Article

class Edition(TimestampMixin, db.Model):
    """
    Represents a specific newspaper edition / issue (e.g., The Times, ED001, Nov 7, 2026).
    """
    __tablename__ = "editions"

    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Primary key UUID, compatible with Supabase PostgreSQL UUID",
    )
    edition_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Edition code identifier string, e.g. ED001, ED002",
    )
    newspaper_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Newspaper publication name, e.g. The Times, The Tribune",
    )
    publication_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        doc="Publication date of the newspaper edition",
    )
    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Location / distribution region, e.g. National Edition, Metropolitan Area",
    )
    weather: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Weather indicator string from masthead, e.g. 18°C Mild & Breezy",
    )
    page_count: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False,
        doc="Total page count of the newspaper edition (typically 5 broadsheet pages)",
    )
    pdf_path: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        doc="Storage path or URL for the original broadsheet PDF file",
    )
    has_qr: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Indicates whether the printed front page includes a scannable QR code",
    )
    tagline: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Newspaper editorial motto / tagline",
    )
    cover_tag: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="Tag banner label, e.g. Today's Lead Edition, Weekend Broadsheet",
    )
    headline_audio_duration: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        doc="Formatted headline digest duration, e.g. 4m 20s",
    )

    __table_args__ = (
        UniqueConstraint("newspaper_name", "publication_date", name="uq_newspaper_date"),
    )

    # Relationship to Articles (ordered by broadsheet page number)
    articles: Mapped[list["Article"]] = relationship(
        "Article",
        back_populates="edition",
        cascade="all, delete-orphan",
        order_by="Article.page_number",
    )
    user_editions: Mapped[list["UserEdition"]] = relationship(
        "UserEdition",
        back_populates="edition",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_articles: bool = False) -> dict:
        data = {
            "id": str(self.id) if self.id else None,
            "edition_code": self.edition_code,
            "newspaper_name": self.newspaper_name,
            "publication_date": self.publication_date.isoformat() if self.publication_date else None,
            "location": self.location,
            "weather": self.weather,
            "page_count": self.page_count,
            "pdf_path": self.pdf_path,
            "has_qr": self.has_qr,
            "tagline": self.tagline,
            "cover_tag": self.cover_tag,
            "headline_audio_duration": self.headline_audio_duration,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_articles:
            data["articles"] = [art.to_dict() for art in self.articles]
        return data

    def __repr__(self) -> str:
        return f"<Edition {self.newspaper_name} ({self.edition_code}) - {self.publication_date}>"
