import uuid
from sqlalchemy import String, Integer, Text, Uuid, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import db, TimestampMixin


class AudioCache(TimestampMixin, db.Model):
    """
    Persistent cache for generated AI summaries, translations, and TTS audio files.
    Ensures identical requests across (article/edition, mode, language, content_version)
    reuse generated audio and text without calling LLMs or speech engines repeatedly.
    """
    __tablename__ = "audio_cache"

    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Primary key UUID",
    )
    article_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Associated article ID (null if edition headlines audio)",
    )
    edition_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("editions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Associated edition ID",
    )
    mode: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Listening mode: 'headlines', 'summary', or 'full'",
    )
    language: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Narration language, e.g. 'English', 'Hindi', 'Kannada', 'Telugu', 'Marathi'",
    )
    voice: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        doc="TTS voice name used for speech generation",
    )
    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="SHA-256 hash of original source text to invalidate cache if content changes",
    )
    text_content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="The text narrated in audio (e.g. summary or translated full article)",
    )
    audio_path: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="Relative path to the audio file on disk",
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Estimated or actual audio duration in seconds",
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="File size of the generated audio in bytes",
    )

    # Relationships
    article = relationship("Article", backref="audio_caches", lazy="joined")
    edition = relationship("Edition", backref="audio_caches", lazy="joined")

    __table_args__ = (
        UniqueConstraint(
            "article_id", "edition_id", "mode", "language", "content_hash",
            name="uq_audio_cache_content"
        ),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "article_id": self.article_id,
            "edition_id": self.edition_id,
            "mode": self.mode,
            "language": self.language,
            "voice": self.voice,
            "text_content": self.text_content,
            "audio_path": self.audio_path,
            "duration_seconds": self.duration_seconds,
            "file_size_bytes": self.file_size_bytes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return f"<AudioCache {self.mode} [{self.language}] ({self.id})>"
