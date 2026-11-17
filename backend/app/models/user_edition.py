import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Uuid, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import db


class UserEdition(db.Model):
    """
    Represents an edition acquired by a user through QR scan or PDF upload.
    Ensures persistent association between users and their unlocked broadsheet editions.
    """
    __tablename__ = "user_editions"

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
    edition_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("editions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Foreign key to the Edition",
    )
    source: Mapped[str] = mapped_column(
        String(50),
        default="qr_scan",
        nullable=False,
        doc="How the user acquired the edition: 'qr_scan', 'pdf_upload'",
    )
    acquired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="Timestamp when the user acquired this edition",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "edition_id", name="uq_user_edition"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="user_editions")
    edition: Mapped["Edition"] = relationship("Edition", back_populates="user_editions")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id) if self.id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "edition_id": str(self.edition_id) if self.edition_id else None,
            "source": self.source,
            "acquired_at": self.acquired_at.isoformat() if self.acquired_at else None,
        }

    def __repr__(self) -> str:
        return f"<UserEdition user={self.user_id} edition={self.edition_id} source={self.source}>"
