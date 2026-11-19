import os
import hashlib
import logging
from typing import Any
from flask import current_app

from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article
from app.models.audio_cache import AudioCache
from app.services.tts_service import SUPPORTED_LANGUAGES, synthesize_speech
from app.services.ai_service import (
    generate_article_summary,
    translate_text,
    generate_headlines_script,
    clean_text_for_narration,
    validate_indic_text,
)

logger = logging.getLogger(__name__)


def get_audio_storage_dir() -> str:
    """Returns absolute path to local audio storage directory."""
    try:
        base_dir = os.path.abspath(os.path.join(current_app.root_path, "..", "uploads", "audio"))
    except RuntimeError:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "audio"))
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


def compute_content_hash(*parts: str) -> str:
    """Computes SHA-256 fingerprint from content parts."""
    hasher = hashlib.sha256()
    for p in parts:
        hasher.update((p or "").encode("utf-8"))
    return hasher.hexdigest()


def get_or_generate_audio(
    article_id: str | None = None,
    edition_id: str | None = None,
    mode: str = "summary",
    language: str = "English",
) -> dict[str, Any]:
    """
    Retrieves or generates audio narration for:
    1. Headlines (edition headlines only)
    2. Article Summary (AI 30-45s summary of article)
    3. Full Article (complete unabridged text)

    Uses multi-tiered caching:
    - Checks AudioCache table for exact (article_id/edition_id, mode, language, content_hash).
    - Verifies audio file exists on disk.
    - If hit, returns immediately without re-calling LLM or TTS.
    - If miss, generates summary/translation, synthesizes speech, caches in DB and filesystem.
    """
    mode = mode.lower().strip()
    if mode not in ["headlines", "summary", "full"]:
        raise ValueError(f"Invalid listening mode '{mode}'. Must be 'headlines', 'summary', or 'full'.")

    # Normalize language name (case-insensitive title-cased)
    lang_match = next((l for l in SUPPORTED_LANGUAGES if l.lower() == language.lower()), None)
    if not lang_match:
        raise ValueError(
            f"Unsupported language '{language}'. Supported languages: {', '.join(SUPPORTED_LANGUAGES.keys())}"
        )
    language = lang_match

    article = None
    edition = None

    if mode in ["summary", "full"]:
        if not article_id:
            raise ValueError(f"Article ID is required for mode '{mode}'.")
        article = db.session.get(Article, article_id)
        if not article:
            raise ValueError(f"Article with ID '{article_id}' not found.")
        edition_id = article.edition_id
        edition = article.edition
    else:  # mode == "headlines"
        if not edition_id and article_id:
            article = db.session.get(Article, article_id)
            if article:
                edition_id = article.edition_id
        if not edition_id:
            raise ValueError("Edition ID is required for 'headlines' mode.")
        raw_edition_id = str(edition_id).strip()
        cleaned_id = raw_edition_id.replace("-headlines", "").strip()
        if "•" in cleaned_id:
            cleaned_id = cleaned_id.split("•")[0].strip()
        if "—" in cleaned_id:
            cleaned_id = cleaned_id.split("—")[0].strip()

        try:
            edition = db.session.get(Edition, cleaned_id)
        except Exception:
            edition = None

        if not edition:
            edition = Edition.query.filter_by(edition_code=cleaned_id).first()

        if not edition and "•" in raw_edition_id:
            name_candidate = raw_edition_id.split("•")[1].strip()
            edition = Edition.query.filter_by(newspaper_name=name_candidate).first()

        if not edition:
            raise ValueError(f"Edition with ID '{edition_id}' not found.")
        edition_id = str(edition.id)

    # 1. Compute content hash to ensure cache invalidation on content edits
    if mode == "headlines":
        headline_list = [a.headline for a in edition.articles if a.is_headline]
        if not headline_list:
            headline_list = [a.headline for a in edition.articles[:8]]
        content_hash = compute_content_hash(edition.id, "|".join(headline_list))
    else:
        content_hash = compute_content_hash(article.id, article.headline, article.content)

    # 2. Check AudioCache
    cache_query = db.session.query(AudioCache).filter_by(
        mode=mode,
        language=language,
        content_hash=content_hash,
    )
    if mode == "headlines":
        cache_query = cache_query.filter_by(edition_id=edition.id)
    else:
        cache_query = cache_query.filter_by(article_id=article.id)

    cached_entry = cache_query.first()
    storage_dir = get_audio_storage_dir()

    if cached_entry:
        # Extra safeguard: verify that cached non-English audio contains genuine Indic script
        is_cache_valid = True
        if language != "English":
            valid, ratio = validate_indic_text(cached_entry.text_content, language)
            if not valid:
                logger.warning(
                    f"Purging corrupted cached entry {cached_entry.id} with invalid {language} text (ratio={ratio:.2f})"
                )
                try:
                    old_path = os.path.join(storage_dir, os.path.basename(cached_entry.audio_path))
                    if os.path.exists(old_path):
                        os.remove(old_path)
                except Exception:
                    pass
                db.session.delete(cached_entry)
                db.session.commit()
                cached_entry = None
                is_cache_valid = False

        if is_cache_valid and cached_entry:
            full_audio_path = os.path.join(storage_dir, os.path.basename(cached_entry.audio_path))
            if os.path.exists(full_audio_path) and os.path.getsize(full_audio_path) > 0:
                logger.info(f"Serving cached audio for mode '{mode}' [{language}]: {cached_entry.id}")
                return {
                    "cache_id": cached_entry.id,
                    "audio_url": f"/api/audio/stream/{os.path.basename(cached_entry.audio_path)}",
                    "mode": mode,
                    "language": language,
                    "voice": cached_entry.voice,
                    "content_hash": cached_entry.content_hash,
                    "text": cached_entry.text_content,
                    "duration_seconds": cached_entry.duration_seconds,
                    "file_size_bytes": cached_entry.file_size_bytes,
                    "cached": True,
                    "article_id": article.id if article else None,
                    "edition_id": edition.id if edition else None,
                }

    # 3. Generate spoken text
    if mode == "headlines":
        spoken_text = generate_headlines_script(
            edition.newspaper_name,
            [a.headline for a in edition.articles if a.is_headline] or [a.headline for a in edition.articles[:8]],
            language=language,
        )
    elif mode == "summary":
        # Always generate AI summary from the original English article content
        en_summary = generate_article_summary(article.headline, article.content)
        if language != "English":
            spoken_text = translate_text(en_summary, language)
        else:
            spoken_text = en_summary
    else:  # mode == "full"
        full_english = f"{article.headline}.\n\n{article.content}"
        if language != "English":
            spoken_text = translate_text(full_english, language)
        else:
            spoken_text = full_english

    # 4. Strict Language Validation Before Speech Synthesis
    if language != "English":
        valid, ratio = validate_indic_text(spoken_text, language)
        if not valid:
            raise ValueError(
                f"Translation validation failed for {language}: output does not contain sufficient Indic script (script ratio: {ratio:.1%}). Audio generation aborted to prevent incorrect speech."
            )

    # 4. Synthesize Audio
    voice_name = SUPPORTED_LANGUAGES[language]["voice"]
    file_id = f"{mode}_{content_hash[:16]}_{language.lower()}"
    filename = f"{file_id}.mp3"
    output_audio_path = os.path.join(storage_dir, filename)

    synth_meta = synthesize_speech(spoken_text, language, output_audio_path)

    # 5. Save or update cache in database
    if not cached_entry:
        cached_entry = AudioCache(
            article_id=article.id if article else None,
            edition_id=edition.id if edition else None,
            mode=mode,
            language=language,
            voice=synth_meta.get("voice", voice_name),
            content_hash=content_hash,
            text_content=spoken_text,
            audio_path=f"uploads/audio/{filename}",
            duration_seconds=synth_meta.get("duration_seconds", 60),
            file_size_bytes=synth_meta.get("file_size_bytes", os.path.getsize(output_audio_path)),
        )
        db.session.add(cached_entry)
    else:
        cached_entry.text_content = spoken_text
        cached_entry.voice = synth_meta.get("voice", voice_name)
        cached_entry.audio_path = f"uploads/audio/{filename}"
        cached_entry.duration_seconds = synth_meta.get("duration_seconds", 60)
        cached_entry.file_size_bytes = synth_meta.get("file_size_bytes", os.path.getsize(output_audio_path))

    db.session.commit()

    return {
        "cache_id": cached_entry.id,
        "audio_url": f"/api/audio/stream/{filename}",
        "mode": mode,
        "language": language,
        "voice": cached_entry.voice,
        "content_hash": cached_entry.content_hash,
        "text": spoken_text,
        "duration_seconds": cached_entry.duration_seconds,
        "file_size_bytes": cached_entry.file_size_bytes,
        "cached": False,
        "article_id": article.id if article else None,
        "edition_id": edition.id if edition else None,
    }
