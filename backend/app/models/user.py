import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import db, TimestampMixin

if TYPE_CHECKING:
    from .history import ListeningHistory
    from .bookmark import Bookmark
    from .user_edition import UserEdition

class User(TimestampMixin, db.Model):
    """
    User entity representing registered Daily Voice accounts,
    synchronized with Supabase Auth (auth.users).
    
    The 'id' column uses SQLAlchemy's Uuid type (compiles to native PostgreSQL UUID
    in production and SQLite CHAR(32) in local tests), ensuring complete type
    compatibility with Supabase auth.users(id).
    """
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Primary key corresponding directly to Supabase auth.users(id) native PostgreSQL UUID",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        default="reader",
        nullable=False,
        doc="User role: reader, editor, admin",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    listening_history: Mapped[list["ListeningHistory"]] = relationship(
        "ListeningHistory",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        "Bookmark",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    user_editions: Mapped[list["UserEdition"]] = relationship(
        "UserEdition",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id) if self.id else None,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
