import uuid
from datetime import datetime, timezone, date
from flask import Blueprint, request, jsonify, g, current_app
from app.models.base import db
from app.models.user import User
from app.models.edition import Edition
from app.models.article import Article
from app.models.history import ListeningHistory
from app.models.bookmark import Bookmark
from app.models.user_edition import UserEdition
from app.middleware.auth import require_auth

user_activity_bp = Blueprint("user_activity", __name__, url_prefix="/api")


def ensure_user_in_db(user_id: str, email: str | None = None, full_name: str | None = None) -> User:
    """
    Ensures a corresponding User record exists in the public database
    for the verified Supabase Auth UUID (foreign key constraints).
    Never trusts unverified client-provided IDs.
    """
    user = db.session.get(User, user_id)
    if not user:
        clean_email = email or f"user-{str(user_id)[:8]}@dailyvoice.com"
        # Avoid unique constraint violation if email already exists under different id
        existing_by_email = User.query.filter_by(email=clean_email).first()
        if existing_by_email:
            clean_email = f"user-{str(user_id)[:8]}@{clean_email.split('@')[-1] if '@' in clean_email else 'dailyvoice.com'}"

        user = User(
            id=user_id,
            email=clean_email,
            full_name=full_name or "Daily Voice Subscriber",
            role="reader",
            is_active=True,
        )
        db.session.add(user)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            user = db.session.get(User, user_id)
            if not user:
                raise
    return user


def format_article_dict(article: Article) -> dict:
    """Formats an Article model into frontend-ready card representation."""
    edition = article.edition
    duration_secs = article.duration_seconds or 180
    mins = duration_secs // 60
    secs = duration_secs % 60
    duration_formatted = f"{mins}:{secs:02d}"

    newspaper_name = edition.newspaper_name if edition else "Daily Voice"
    pub_date = (
        edition.publication_date.strftime("%b %d, %Y")
        if edition and edition.publication_date
        else "Nov 14, 2026"
    )

    return {
        "id": str(article.id),
        "article_id": str(article.id),
        "title": article.headline,
        "headline": article.headline,
        "category": article.category,
        "newspaperName": newspaper_name,
        "newspaper_name": newspaper_name,
        "publisher": newspaper_name,
        "publishDate": pub_date,
        "publish_date": pub_date,
        "page_number": article.page_number,
        "pageNumber": article.page_number,
        "durationSeconds": duration_secs,
        "duration_seconds": duration_secs,
        "durationFormatted": duration_formatted,
        "summary": article.summary or (article.content[:220] + "..." if article.content else ""),
        "content": article.content,
        "editionId": str(article.edition_id) if article.edition_id else None,
        "edition_id": str(article.edition_id) if article.edition_id else None,
        "edition_code": edition.edition_code if edition else None,
        "audio_url": article.audio_url,
        "isHeadline": article.is_headline,
        "is_headline": article.is_headline,
    }


def format_headline_digest_dict(edition: Edition, duration_seconds: int = 240) -> dict:
    """Formats an Edition model into a frontend-ready card representation for Headline Digest."""
    newspaper_name = edition.newspaper_name if edition else "Daily Broadsheet"
    pub_date = (
        edition.publication_date.strftime("%b %d, %Y")
        if edition and edition.publication_date
        else "Nov 14, 2026"
    )
    dur = duration_seconds if duration_seconds > 0 else 240
    mins = dur // 60
    secs = dur % 60
    duration_formatted = f"{mins}:{secs:02d}"
    headline_title = f"{newspaper_name} - Headline Digest"

    return {
        "id": str(edition.id),
        "article_id": None,
        "articleId": None,
        "title": headline_title,
        "headline": headline_title,
        "category": "Headline Digest",
        "newspaperName": newspaper_name,
        "newspaper_name": newspaper_name,
        "publisher": newspaper_name,
        "publishDate": pub_date,
        "publish_date": pub_date,
        "page_number": 1,
        "pageNumber": 1,
        "durationSeconds": dur,
        "duration_seconds": dur,
        "durationFormatted": duration_formatted,
        "summary": f"Audio narration of key headlines from {newspaper_name}.",
        "content": "",
        "editionId": str(edition.id),
        "edition_id": str(edition.id),
        "edition_code": edition.edition_code if edition else None,
        "audio_url": None,
        "isHeadline": True,
        "is_headline": True,
        "isEdition": True,
        "is_edition": True,
    }


def format_friendly_time(dt: datetime | None) -> str:
    """Formats a datetime into a human-friendly listening timeline string."""
    if not dt:
        return "Recently"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    total_seconds = diff.total_seconds()
    if total_seconds < 60:
        return "Just now"
    if total_seconds < 3600:
        mins = max(1, int(total_seconds // 60))
        return f"{mins} min ago" if mins == 1 else f"{mins} mins ago"
    if total_seconds < 86400:
        hours = max(1, int(total_seconds // 3600))
        return f"{hours} hour ago" if hours == 1 else f"{hours} hours ago"
    if total_seconds < 172800:
        return f"Yesterday at {dt.strftime('%I:%M %p')}"
    return dt.strftime("%b %d, %Y")


# -------------------------------------------------------------------------
# User Edition Association Endpoints (Acquired via QR Scan / PDF Upload)
# -------------------------------------------------------------------------

@user_activity_bp.route("/user/editions", methods=["GET"])
@require_auth
def get_user_editions():
    """
    Returns all newspaper editions acquired by the authenticated user,
    ordered by most recently acquired first.
    Strictly isolated per user identity derived from verified JWT.
    """
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    records = (
        UserEdition.query.filter_by(user_id=user_id)
        .order_by(UserEdition.acquired_at.desc())
        .all()
    )

    editions_list = []
    edition_ids = []

    for rec in records:
        if not rec.edition:
            continue
        ed = rec.edition
        ed_dict = ed.to_dict(include_articles=True)
        ed_dict["article_count"] = len(ed.articles)
        ed_dict["acquired_at"] = rec.acquired_at.isoformat() if rec.acquired_at else None
        ed_dict["acquired_source"] = rec.source
        editions_list.append(ed_dict)
        edition_ids.append(str(ed.id))

    return jsonify({
        "status": "success",
        "count": len(editions_list),
        "data": editions_list,
        "edition_ids": edition_ids,
    }), 200


@user_activity_bp.route("/user/editions", methods=["POST"])
@require_auth
def add_user_edition():
    """
    Associates an acquired newspaper edition with the authenticated user account.
    Avoids duplicate associations idempotently.
    Strictly isolated per user identity derived from verified JWT.
    """
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    data = request.get_json(silent=True) or {}
    edition_id = data.get("edition_id") or data.get("editionId")
    if not edition_id:
        return jsonify({
            "status": "error",
            "code": "MISSING_EDITION_ID",
            "message": "edition_id is required",
        }), 400

    edition = db.session.get(Edition, edition_id)
    if not edition:
        return jsonify({
            "status": "error",
            "code": "EDITION_NOT_FOUND",
            "message": f"Edition with id '{edition_id}' not found in database",
        }), 404

    source = data.get("source", "qr_scan")
    if source not in ("qr_scan", "pdf_upload", "direct"):
        source = "qr_scan"

    existing = UserEdition.query.filter_by(user_id=user_id, edition_id=edition_id).first()
    if existing:
        existing.acquired_at = datetime.now(timezone.utc)
        if source:
            existing.source = source
    else:
        new_assoc = UserEdition(
            user_id=user_id,
            edition_id=edition_id,
            source=source,
            acquired_at=datetime.now(timezone.utc),
        )
        db.session.add(new_assoc)

    db.session.commit()

    ed_dict = edition.to_dict(include_articles=True)
    ed_dict["article_count"] = len(edition.articles)
    ed_dict["acquired_source"] = source

    return jsonify({
        "status": "success",
        "message": f"Edition '{edition.newspaper_name}' ({edition.edition_code}) successfully linked to user account.",
        "data": ed_dict,
    }), 201


@user_activity_bp.route("/user/editions/<edition_id>", methods=["DELETE"])
@require_auth
def remove_user_edition(edition_id: str):
    """
    Removes an edition association from the authenticated user's collection.
    Does NOT delete the global newspaper edition itself.
    """
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    existing = UserEdition.query.filter_by(user_id=user_id, edition_id=edition_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Edition removed from user collection",
        "edition_id": edition_id,
    }), 200


# -------------------------------------------------------------------------
# Listening History Endpoints
# -------------------------------------------------------------------------

@user_activity_bp.route("/history", methods=["GET"])
@require_auth
def get_listening_history():
    """Returns the authenticated user's listening history records sorted by most recent activity."""
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    records = (
        ListeningHistory.query.filter_by(user_id=user_id)
        .order_by(ListeningHistory.last_played_at.desc())
        .all()
    )

    history_list = []
    seen_keys = set()
    for rec in records:
        if rec.article:
            item_dict = format_article_dict(rec.article)
            ed_id = str(rec.edition_id) if rec.edition_id else (str(rec.article.edition_id) if rec.article and rec.article.edition_id else None)
            dur_secs = rec.duration_seconds or rec.article.duration_seconds or 180
            dedup_key = f"art-{rec.article_id}"
        elif rec.listening_mode == "headlines" or not rec.article_id:
            edition = rec.edition or (db.session.get(Edition, rec.edition_id) if rec.edition_id else None)
            if not edition:
                continue
            dur_secs = rec.duration_seconds or 240
            item_dict = format_headline_digest_dict(edition, dur_secs)
            ed_id = str(rec.edition_id)
            dedup_key = f"digest-{ed_id}"
        else:
            continue

        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        history_list.append({
            "id": str(rec.id),
            "articleId": str(rec.article_id) if rec.article_id else None,
            "article_id": str(rec.article_id) if rec.article_id else None,
            "editionId": ed_id,
            "edition_id": ed_id,
            "listeningMode": getattr(rec, "listening_mode", "summary") or "summary",
            "listening_mode": getattr(rec, "listening_mode", "summary") or "summary",
            "language": getattr(rec, "language", "English") or "English",
            "progressSeconds": round(rec.progress_seconds, 1),
            "progress_seconds": round(rec.progress_seconds, 1),
            "durationSeconds": dur_secs,
            "duration_seconds": dur_secs,
            "isCompleted": bool(rec.is_completed),
            "is_completed": bool(rec.is_completed),
            "lastPlayedAt": format_friendly_time(rec.last_played_at),
            "last_played_at": rec.last_played_at.isoformat() if rec.last_played_at else None,
            "article": item_dict,
        })

    return jsonify({
        "status": "success",
        "count": len(history_list),
        "history": history_list,
    }), 200


def format_listening_duration(seconds: float) -> str:
    """Formats actual listening seconds into a clear human-readable duration (e.g. 14s, 1m 20s, 1h 15m)."""
    secs_int = int(round(max(0.0, float(seconds or 0.0))))
    if secs_int <= 0:
        return "0m"
    if secs_int < 60:
        return f"{secs_int}s"
    if secs_int < 3600:
        mins = secs_int // 60
        rem_secs = secs_int % 60
        return f"{mins}m {rem_secs}s" if rem_secs > 0 else f"{mins}m"
    hrs = secs_int // 3600
    mins = (secs_int % 3600) // 60
    return f"{hrs}h {mins}m" if mins > 0 else f"{hrs}h"


def compute_user_stats(user_id: str, local_date: str | None = None) -> dict:
    """
    Computes authoritative user listening statistics strictly from persisted
    ListeningHistory records for the authenticated user.
    """
    target_date = (local_date or "").strip() or datetime.now(timezone.utc).date().isoformat()
    records = ListeningHistory.query.filter_by(user_id=user_id).all()

    total_completed = sum(1 for r in records if r.is_completed)
    total_in_progress = sum(1 for r in records if not r.is_completed)

    total_seconds = sum(
        (r.total_listened_seconds if (r.total_listened_seconds or 0.0) > 0.0 else (r.progress_seconds or 0.0))
        for r in records
    )
    total_minutes = round(total_seconds / 60)

    time_today_seconds = 0.0
    for r in records:
        if r.daily_listened_date == target_date:
            time_today_seconds += float(r.daily_listened_seconds or 0.0)
        elif not r.daily_listened_date and r.last_played_at:
            # Backward compatibility for pre-migration rows
            if r.last_played_at.date().isoformat() == target_date:
                time_today_seconds += float(r.progress_seconds or 0.0)

    time_today_minutes = round(time_today_seconds / 60)
    time_today_display = format_listening_duration(time_today_seconds)

    edition_ids = set()
    for r in records:
        ed_id = r.edition_id or (r.article.edition_id if r.article else None)
        if ed_id:
            edition_ids.add(str(ed_id))
    editions_count = len(edition_ids)

    editions_display = (
        f"Across {editions_count} newspaper {'edition' if editions_count == 1 else 'editions'}"
        if editions_count > 0
        else "Start listening to track daily broadsheet activity"
    )

    return {
        "total_completed": total_completed,
        "total_in_progress": total_in_progress,
        "total_listening_minutes": total_minutes,
        "total_listening_seconds": round(total_seconds, 1),
        "time_today_minutes": time_today_minutes,
        "time_today_seconds": round(time_today_seconds, 1),
        "time_today_display": time_today_display,
        "local_date": target_date,
        "editions_count": editions_count,
        "editions_display": editions_display,
        "total_sessions": len(records),
    }


@user_activity_bp.route("/history", methods=["POST"])
@require_auth
def record_listening_history():
    """Records or updates listening progress, actual playback time, and completion status for an article or headline digest."""
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    data = request.get_json(silent=True) or {}
    article_id = data.get("article_id") or data.get("articleId")
    edition_id = data.get("edition_id") or data.get("editionId")
    listening_mode = data.get("listening_mode") or data.get("listeningMode") or "summary"
    language = data.get("language") or "English"
    local_date = (data.get("local_date") or data.get("localDate") or "").strip() or datetime.now(timezone.utc).date().isoformat()

    is_edition_flag = bool(data.get("is_edition") or data.get("isEdition"))
    is_headline_digest = bool(is_edition_flag or (listening_mode == "headlines") or not article_id)

    if is_headline_digest:
        listening_mode = "headlines"
        article_id = None
        if not edition_id:
            return jsonify({
                "status": "error",
                "code": "MISSING_EDITION_ID",
                "message": "edition_id is required for headline digest listening history",
            }), 400

        # Robust edition lookup supporting UUID, edition_code, or composite display name
        edition = None
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
            return jsonify({
                "status": "error",
                "code": "EDITION_NOT_FOUND",
                "message": f"Edition with id '{edition_id}' not found",
            }), 404

        edition_id = str(edition.id)
        article = None
        article_id = None
        duration_seconds = int(data.get("duration_seconds", data.get("durationSeconds", 240)))
        if duration_seconds <= 0:
            duration_seconds = 240
    else:
        if not article_id:
            return jsonify({
                "status": "error",
                "code": "MISSING_ARTICLE_ID",
                "message": "article_id is required",
            }), 400
        article = db.session.get(Article, article_id)
        if not article:
            return jsonify({
                "status": "error",
                "code": "ARTICLE_NOT_FOUND",
                "message": f"Article with id '{article_id}' not found",
            }), 404
        if not edition_id and article.edition_id:
            edition_id = str(article.edition_id)
        edition = article.edition if article else None
        duration_seconds = int(
            data.get("duration_seconds", data.get("durationSeconds", article.duration_seconds or 180))
        )
        if duration_seconds <= 0:
            duration_seconds = 180

    progress_seconds = max(0.0, float(data.get("progress_seconds", data.get("progressSeconds", 0.0))))

    has_explicit_delta = ("listened_delta_seconds" in data) or ("listenedDeltaSeconds" in data)
    raw_delta = data.get("listened_delta_seconds", data.get("listenedDeltaSeconds", 0.0))

    is_completed_explicit = data.get("is_completed", data.get("isCompleted", None))
    threshold_reached = False
    if duration_seconds > 0:
        threshold_reached = (progress_seconds >= duration_seconds - 5) or (
            (progress_seconds / duration_seconds) >= 0.90
        )

    if is_headline_digest:
        existing = (
            ListeningHistory.query.filter(
                ListeningHistory.user_id == user_id,
                ListeningHistory.edition_id == edition_id,
                ListeningHistory.listening_mode == "headlines",
            )
            .order_by(ListeningHistory.last_played_at.desc())
            .first()
        )
        if not existing:
            existing = (
                ListeningHistory.query.filter(
                    ListeningHistory.user_id == user_id,
                    ListeningHistory.edition_id == edition_id,
                    ListeningHistory.article_id.is_(None),
                )
                .order_by(ListeningHistory.last_played_at.desc())
                .first()
            )
    else:
        existing = ListeningHistory.query.filter_by(
            user_id=user_id, article_id=article_id
        ).first()

    if existing:
        prev_progress = float(existing.progress_seconds or 0.0)
        if has_explicit_delta:
            delta_sec = max(0.0, min(float(raw_delta or 0.0), 3600.0))
        else:
            delta_sec = max(0.0, progress_seconds - prev_progress)

        existing.progress_seconds = progress_seconds
        if duration_seconds > 0:
            existing.duration_seconds = duration_seconds
        if edition_id:
            existing.edition_id = edition_id
        if listening_mode:
            existing.listening_mode = listening_mode
        if language:
            existing.language = language

        if is_headline_digest:
            existing.article_id = None

        existing.total_listened_seconds = float(existing.total_listened_seconds or 0.0) + delta_sec
        if existing.daily_listened_date == local_date:
            existing.daily_listened_seconds = float(existing.daily_listened_seconds or 0.0) + delta_sec
        else:
            existing.daily_listened_date = local_date
            existing.daily_listened_seconds = delta_sec

        existing.last_played_at = datetime.now(timezone.utc)

        if is_completed_explicit is not None:
            # Sticky completion: once completed, replaying or seeking does not un-complete the session
            if bool(is_completed_explicit):
                existing.is_completed = True
        elif threshold_reached:
            existing.is_completed = True

        if is_headline_digest:
            # Deduplicate any extra rows for this user & edition
            duplicates = ListeningHistory.query.filter(
                ListeningHistory.user_id == user_id,
                ListeningHistory.edition_id == edition_id,
                ListeningHistory.listening_mode == "headlines",
                ListeningHistory.id != existing.id,
            ).all()
            for dup in duplicates:
                db.session.delete(dup)
    else:
        if has_explicit_delta:
            delta_sec = max(0.0, min(float(raw_delta or 0.0), 3600.0))
        else:
            delta_sec = max(0.0, progress_seconds)

        is_completed = False
        if is_completed_explicit is not None:
            is_completed = bool(is_completed_explicit)
        elif threshold_reached:
            is_completed = True

        existing = ListeningHistory(
            user_id=user_id,
            article_id=None if is_headline_digest else article_id,
            edition_id=edition_id,
            listening_mode=listening_mode,
            language=language,
            progress_seconds=progress_seconds,
            duration_seconds=duration_seconds,
            total_listened_seconds=delta_sec,
            daily_listened_seconds=delta_sec,
            daily_listened_date=local_date,
            is_completed=is_completed,
            last_played_at=datetime.now(timezone.utc),
        )
        db.session.add(existing)

    try:
        db.session.commit()
        db.session.refresh(existing)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to commit listening history: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "code": "DB_COMMIT_ERROR",
            "message": f"Database commit failed: {str(e)}",
        }), 500

    item_dict = (
        format_headline_digest_dict(edition, existing.duration_seconds)
        if is_headline_digest
        else format_article_dict(article)
    )
    stats = compute_user_stats(user_id, local_date)
    return jsonify({
        "status": "success",
        "message": "Listening progress saved",
        "data": {
            "id": str(existing.id),
            "articleId": str(existing.article_id) if existing.article_id else None,
            "article_id": str(existing.article_id) if existing.article_id else None,
            "editionId": str(existing.edition_id) if existing.edition_id else None,
            "edition_id": str(existing.edition_id) if existing.edition_id else None,
            "listeningMode": getattr(existing, "listening_mode", "summary") or "summary",
            "listening_mode": getattr(existing, "listening_mode", "summary") or "summary",
            "language": getattr(existing, "language", "English") or "English",
            "progressSeconds": round(existing.progress_seconds, 1),
            "progress_seconds": round(existing.progress_seconds, 1),
            "durationSeconds": existing.duration_seconds,
            "duration_seconds": existing.duration_seconds,
            "totalListenedSeconds": round(float(existing.total_listened_seconds or 0.0), 1),
            "dailyListenedSeconds": round(float(existing.daily_listened_seconds or 0.0), 1),
            "dailyListenedDate": existing.daily_listened_date,
            "isCompleted": bool(existing.is_completed),
            "is_completed": bool(existing.is_completed),
            "lastPlayedAt": format_friendly_time(existing.last_played_at),
            "last_played_at": existing.last_played_at.isoformat() if existing.last_played_at else None,
            "article": item_dict,
        },
        "stats": stats,
    }), 200


@user_activity_bp.route("/history/stats", methods=["GET"])
@require_auth
def get_user_stats():
    """Computes dynamic user reading telemetry and listening statistics."""
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    local_date = request.args.get("local_date") or request.args.get("localDate")
    stats = compute_user_stats(user_id, local_date)
    return jsonify({
        "status": "success",
        "stats": stats,
    }), 200


# -------------------------------------------------------------------------
# Bookmarks Endpoints
# -------------------------------------------------------------------------

@user_activity_bp.route("/bookmarks", methods=["GET"])
@require_auth
def get_bookmarks():
    """Returns the authenticated user's bookmarked articles with full metadata."""
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    records = (
        Bookmark.query.filter_by(user_id=user_id)
        .order_by(Bookmark.saved_at.desc())
        .all()
    )

    bookmarks_list = []
    saved_articles = []
    saved_article_ids = []

    for bm in records:
        if not bm.article:
            continue
        art_dict = format_article_dict(bm.article)
        saved_articles.append(art_dict)
        saved_article_ids.append(str(bm.article_id))
        bookmarks_list.append({
            "id": str(bm.id),
            "articleId": str(bm.article_id),
            "article_id": str(bm.article_id),
            "savedAt": bm.saved_at.isoformat() if bm.saved_at else None,
            "saved_at": bm.saved_at.isoformat() if bm.saved_at else None,
            "article": art_dict,
        })

    return jsonify({
        "status": "success",
        "count": len(bookmarks_list),
        "bookmarks": bookmarks_list,
        "articles": saved_articles,
        "saved_article_ids": saved_article_ids,
        "savedArticleIds": saved_article_ids,
    }), 200


@user_activity_bp.route("/bookmarks", methods=["POST"])
@require_auth
def add_bookmark():
    """Bookmarks an article for later listening."""
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    data = request.get_json(silent=True) or {}
    article_id = data.get("article_id") or data.get("articleId")
    if not article_id:
        return jsonify({
            "status": "error",
            "code": "MISSING_ARTICLE_ID",
            "message": "article_id is required",
        }), 400

    article = db.session.get(Article, article_id)
    if not article:
        return jsonify({
            "status": "error",
            "code": "ARTICLE_NOT_FOUND",
            "message": f"Article with id '{article_id}' not found",
        }), 404

    existing = Bookmark.query.filter_by(user_id=user_id, article_id=article_id).first()
    if not existing:
        existing = Bookmark(
            user_id=user_id,
            article_id=article_id,
            saved_at=datetime.now(timezone.utc),
        )
        db.session.add(existing)
        db.session.commit()

    art_dict = format_article_dict(article)
    return jsonify({
        "status": "success",
        "message": "Article bookmarked",
        "data": {
            "id": str(existing.id),
            "articleId": str(existing.article_id),
            "article_id": str(existing.article_id),
            "savedAt": existing.saved_at.isoformat(),
            "article": art_dict,
        },
    }), 201


@user_activity_bp.route("/bookmarks/<article_id>", methods=["DELETE"])
@require_auth
def delete_bookmark(article_id: str):
    """Removes a bookmark for the specified article."""
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    existing = Bookmark.query.filter_by(
        user_id=user_id, article_id=article_id
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Bookmark removed",
        "article_id": article_id,
    }), 200


@user_activity_bp.route("/bookmarks/toggle", methods=["POST"])
@require_auth
def toggle_bookmark():
    """Toggles bookmark status for an article."""
    user_id = g.current_user["id"]
    ensure_user_in_db(user_id, g.current_user.get("email"), g.current_user.get("full_name"))

    data = request.get_json(silent=True) or {}
    article_id = data.get("article_id") or data.get("articleId")
    if not article_id:
        return jsonify({
            "status": "error",
            "code": "MISSING_ARTICLE_ID",
            "message": "article_id is required",
        }), 400

    article = db.session.get(Article, article_id)
    if not article:
        return jsonify({
            "status": "error",
            "code": "ARTICLE_NOT_FOUND",
            "message": f"Article with id '{article_id}' not found",
        }), 404

    existing = Bookmark.query.filter_by(
        user_id=user_id, article_id=article_id
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        bookmarked = False
    else:
        new_bm = Bookmark(
            user_id=user_id,
            article_id=article_id,
            saved_at=datetime.now(timezone.utc),
        )
        db.session.add(new_bm)
        db.session.commit()
        bookmarked = True

    return jsonify({
        "status": "success",
        "article_id": article_id,
        "bookmarked": bookmarked,
    }), 200
