import time
import uuid
import jwt
import pytest
from datetime import datetime, timezone, date
from app.models.base import db
from app.models.user import User
from app.models.edition import Edition
from app.models.article import Article
from app.models.history import ListeningHistory
from app.models.bookmark import Bookmark
from app.models.user_edition import UserEdition


def make_auth_token(app, user_id=None, email="reader@dailyvoice.com", exp_delta=3600):
    """Generates a verified HS256 Supabase JWT for the given user UUID."""
    if user_id is None:
        user_id = str(uuid.uuid4())
    secret = app.config.get("SUPABASE_JWT_SECRET", "test-jwt-secret-key-for-unit-testing-32-chars-minimum")
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + exp_delta,
        "iat": int(time.time()),
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    return user_id, token


@pytest.fixture
def seed_test_data(app):
    """Creates sample editions and articles for testing."""
    with app.app_context():
        edition1 = Edition(
            edition_code="ED001",
            newspaper_name="The Times",
            publication_date=date(2026, 11, 14),
            page_count=5,
            has_qr=True,
        )
        edition2 = Edition(
            edition_code="ED002",
            newspaper_name="The Tribune",
            publication_date=date(2026, 11, 14),
            page_count=5,
            has_qr=True,
        )
        db.session.add_all([edition1, edition2])
        db.session.commit()

        art1 = Article(
            edition_id=edition1.id,
            category="Current Affairs",
            headline="Headline Story 1",
            content="Full content of story 1...",
            duration_seconds=180,
            page_number=1,
            is_headline=True,
        )
        art2 = Article(
            edition_id=edition1.id,
            category="Finance",
            headline="Market Trends Report",
            content="Full content of story 2...",
            duration_seconds=240,
            page_number=2,
            is_headline=False,
        )
        db.session.add_all([art1, art2])
        db.session.commit()

        yield {
            "edition1": edition1,
            "edition2": edition2,
            "art1": art1,
            "art2": art2,
        }


# -------------------------------------------------------------------------
# Security & Authentication Verification Tests
# -------------------------------------------------------------------------

def test_unauthenticated_requests_rejected(client, seed_test_data):
    """User-owned APIs strictly reject unauthenticated requests."""
    res_ed = client.get("/api/user/editions")
    assert res_ed.status_code == 401
    assert res_ed.get_json()["code"] == "AUTH_HEADER_MISSING"

    res_hist = client.get("/api/history")
    assert res_hist.status_code == 401
    assert res_hist.get_json()["code"] == "AUTH_HEADER_MISSING"

    res_bm = client.get("/api/bookmarks")
    assert res_bm.status_code == 401
    assert res_bm.get_json()["code"] == "AUTH_HEADER_MISSING"


def test_auth_status_endpoint(client):
    """Auth status reports whether Supabase Auth is active and which strategy is used."""
    res = client.get("/api/auth/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["configured"] is True


# -------------------------------------------------------------------------
# User Edition Association & Persistence Tests
# -------------------------------------------------------------------------

def test_user_editions_empty_initially(client, app, seed_test_data):
    """A newly registered user has no acquired editions initially."""
    user_id, token = make_auth_token(app)
    res = client.get(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["count"] == 0
    assert data["data"] == []


def test_add_and_get_user_edition(client, app, seed_test_data):
    """Associating an edition via QR scan or upload persists it in backend database."""
    user_id, token = make_auth_token(app)
    ed1_id = str(seed_test_data["edition1"].id)

    # 1. Add edition
    add_res = client.post(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token}"},
        json={"edition_id": ed1_id, "source": "qr_scan"},
    )
    assert add_res.status_code == 201
    assert add_res.get_json()["data"]["newspaper_name"] == "The Times"

    # 2. Get user editions
    get_res = client.get(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    data = get_res.get_json()
    assert data["count"] == 1
    assert data["data"][0]["newspaper_name"] == "The Times"
    assert ed1_id in data["edition_ids"]


def test_add_user_edition_duplicate_avoidance(client, app, seed_test_data):
    """Re-scanning or re-adding an edition does not create duplicate database rows."""
    user_id, token = make_auth_token(app)
    ed1_id = str(seed_test_data["edition1"].id)

    client.post(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token}"},
        json={"edition_id": ed1_id, "source": "qr_scan"},
    )
    client.post(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token}"},
        json={"edition_id": ed1_id, "source": "qr_scan"},
    )

    get_res = client.get(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.get_json()["count"] == 1


def test_edition_persistence_across_login(client, app, seed_test_data):
    """
    CRITICAL: User A acquires an edition, logs out, and logs back in with a new session.
    All previously acquired editions must be retrieved from backend storage.
    """
    user_a_id = str(uuid.uuid4())
    # Session 1: User A scans The Times
    _, token1 = make_auth_token(app, user_id=user_a_id)
    ed1_id = str(seed_test_data["edition1"].id)
    client.post(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token1}"},
        json={"edition_id": ed1_id, "source": "qr_scan"},
    )

    # Session 2: User A logs in again (new session token, same user UUID)
    _, token2 = make_auth_token(app, user_id=user_a_id)
    restore_res = client.get(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert restore_res.status_code == 200
    restored_data = restore_res.get_json()
    assert restored_data["count"] == 1
    assert restored_data["data"][0]["newspaper_name"] == "The Times"
    assert ed1_id in restored_data["edition_ids"]


def test_user_isolation_editions(client, app, seed_test_data):
    """
    CRITICAL: User A acquires The Times; User B acquires The Tribune.
    Neither user sees the other user's editions.
    """
    user_a_id, token_a = make_auth_token(app)
    user_b_id, token_b = make_auth_token(app)
    ed1_id = str(seed_test_data["edition1"].id)
    ed2_id = str(seed_test_data["edition2"].id)

    # User A acquires The Times
    client.post(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"edition_id": ed1_id, "source": "qr_scan"},
    )

    # User B acquires The Tribune
    client.post(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"edition_id": ed2_id, "source": "pdf_upload"},
    )

    # Verify User A only sees The Times
    a_res = client.get("/api/user/editions", headers={"Authorization": f"Bearer {token_a}"})
    a_data = a_res.get_json()
    assert a_data["count"] == 1
    assert a_data["data"][0]["newspaper_name"] == "The Times"
    assert ed2_id not in a_data["edition_ids"]

    # Verify User B only sees The Tribune
    b_res = client.get("/api/user/editions", headers={"Authorization": f"Bearer {token_b}"})
    b_data = b_res.get_json()
    assert b_data["count"] == 1
    assert b_data["data"][0]["newspaper_name"] == "The Tribune"
    assert ed1_id not in b_data["edition_ids"]


def test_remove_user_edition(client, app, seed_test_data):
    """Removing an edition disassociates it from user without deleting the global edition."""
    user_id, token = make_auth_token(app)
    ed1_id = str(seed_test_data["edition1"].id)

    client.post(
        "/api/user/editions",
        headers={"Authorization": f"Bearer {token}"},
        json={"edition_id": ed1_id, "source": "qr_scan"},
    )

    del_res = client.delete(
        f"/api/user/editions/{ed1_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200

    # User's list is now empty
    get_res = client.get("/api/user/editions", headers={"Authorization": f"Bearer {token}"})
    assert get_res.get_json()["count"] == 0

    # But global edition still exists in database!
    global_res = client.get(f"/api/editions/{ed1_id}")
    assert global_res.status_code == 200
    assert global_res.get_json()["data"]["newspaper_name"] == "The Times"


# -------------------------------------------------------------------------
# Listening History & Dynamic Stats Tests
# -------------------------------------------------------------------------

def test_record_listening_progress_partial(client, app, seed_test_data):
    """Partially listening to an article does not mark it as completed."""
    user_id, token = make_auth_token(app)
    art1_id = str(seed_test_data["art1"].id)

    res = client.post(
        "/api/history",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "article_id": art1_id,
            "progress_seconds": 45.0,
            "duration_seconds": 180,
        },
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["data"]["isCompleted"] is False
    assert data["data"]["progressSeconds"] == 45.0
    assert data["data"]["article"]["headline"] == "Headline Story 1"

    # Verify history listing
    list_res = client.get("/api/history", headers={"Authorization": f"Bearer {token}"})
    list_data = list_res.get_json()
    assert list_data["count"] == 1
    assert list_data["history"][0]["isCompleted"] is False


def test_record_listening_progress_completion_threshold(client, app, seed_test_data):
    """Reaching >= 90% or duration-5s automatically marks article as completed."""
    user_id, token = make_auth_token(app)
    art1_id = str(seed_test_data["art1"].id)

    res = client.post(
        "/api/history",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "article_id": art1_id,
            "progress_seconds": 176.0,
            "duration_seconds": 180,
        },
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["data"]["isCompleted"] is True

    # Check stats endpoint
    stats_res = client.get("/api/history/stats", headers={"Authorization": f"Bearer {token}"})
    assert stats_res.status_code == 200
    stats = stats_res.get_json()["stats"]
    assert stats["total_completed"] == 1
    assert stats["total_in_progress"] == 0
    assert stats["total_listening_minutes"] == 3


def test_stats_dynamic_calculations(client, app, seed_test_data):
    """Stats calculates completed, in progress, total minutes and editions correctly."""
    user_id, token = make_auth_token(app)
    art1_id = str(seed_test_data["art1"].id)
    art2_id = str(seed_test_data["art2"].id)

    # Art 1 completed
    client.post(
        "/api/history",
        headers={"Authorization": f"Bearer {token}"},
        json={"article_id": art1_id, "progress_seconds": 180.0, "is_completed": True},
    )
    # Art 2 in progress
    client.post(
        "/api/history",
        headers={"Authorization": f"Bearer {token}"},
        json={"article_id": art2_id, "progress_seconds": 60.0, "duration_seconds": 240},
    )

    stats_res = client.get("/api/history/stats", headers={"Authorization": f"Bearer {token}"})
    stats = stats_res.get_json()["stats"]
    assert stats["total_completed"] == 1
    assert stats["total_in_progress"] == 1
    assert stats["total_sessions"] == 2
    assert stats["total_listening_minutes"] == 4


# -------------------------------------------------------------------------
# Bookmarks CRUD & Isolation Tests
# -------------------------------------------------------------------------

def test_bookmarks_crud_flow(client, app, seed_test_data):
    """Full bookmarking, listing, and deletion flow with verified JWT."""
    user_id, token = make_auth_token(app)
    art1_id = str(seed_test_data["art1"].id)

    # 1. Empty initially
    res = client.get("/api/bookmarks", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.get_json()["count"] == 0

    # 2. Add bookmark
    add_res = client.post(
        "/api/bookmarks",
        headers={"Authorization": f"Bearer {token}"},
        json={"article_id": art1_id},
    )
    assert add_res.status_code == 201

    # 3. Verify in bookmarks list
    list_res = client.get("/api/bookmarks", headers={"Authorization": f"Bearer {token}"})
    assert list_res.get_json()["count"] == 1
    assert art1_id in list_res.get_json()["saved_article_ids"]

    # 4. Delete bookmark
    del_res = client.delete(
        f"/api/bookmarks/{art1_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200

    # 5. Verify removed
    verify_res = client.get("/api/bookmarks", headers={"Authorization": f"Bearer {token}"})
    assert verify_res.get_json()["count"] == 0


def test_user_data_isolation_history_and_bookmarks(client, app, seed_test_data):
    """User A's listening history and bookmarks are strictly segregated from User B."""
    user_a_id, token_a = make_auth_token(app)
    user_b_id, token_b = make_auth_token(app)
    art1_id = str(seed_test_data["art1"].id)

    client.post(
        "/api/history",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"article_id": art1_id, "progress_seconds": 120.0, "is_completed": True},
    )
    client.post(
        "/api/bookmarks",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"article_id": art1_id},
    )

    b_history = client.get("/api/history", headers={"Authorization": f"Bearer {token_b}"}).get_json()
    b_bookmarks = client.get("/api/bookmarks", headers={"Authorization": f"Bearer {token_b}"}).get_json()

    assert b_history["count"] == 0
    assert b_bookmarks["count"] == 0


# -------------------------------------------------------------------------
# Full End-to-End Multi-User Isolation, Login/Logout & Persistence Suite
# -------------------------------------------------------------------------

def test_auth_login_deterministic_uuid_across_sessions(client, app):
    """
    Verifies that logging in with the same email after logout returns the
    EXACT SAME user UUID and a valid signed JWT, preventing data loss.
    """
    res1 = client.post("/api/auth/login", json={"email": "alice@dailyvoice.com"})
    assert res1.status_code == 200
    data1 = res1.get_json()
    user_id_1 = data1["user"]["id"]
    token_1 = data1["session"]["access_token"]

    # Verify token works on protected endpoint
    verify_res = client.get("/api/auth/verify", headers={"Authorization": f"Bearer {token_1}"})
    assert verify_res.status_code == 200
    assert verify_res.get_json()["user"]["id"] == user_id_1

    # Simulate logout and login again with same email
    res2 = client.post("/api/auth/login", json={"email": "alice@dailyvoice.com"})
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2["user"]["id"] == user_id_1


def test_complete_two_user_isolation_and_persistence_simulation(client, app, seed_test_data):
    """
    STEP 8 Complete Simulation:
    User A:
      - Acquires one QR newspaper (edition1)
      - Uploads/acquires one PDF newspaper (edition3)
      - Bookmarks two articles (art1, art2)
      - Listens to art1 partially (summary mode, English)
      - Completes art2 (full mode, Hindi)
    User B:
      - Acquires a different newspaper (edition2)
      - Bookmarks a different article (art3)
      - Has independent listening history (art3 partially)

    Verifies strict isolation, login/logout survival, cross-account protection,
    Dashboard/Library consistency, and listening resume metadata.
    """
    with app.app_context():
        ed3 = Edition(
            edition_code="ED003",
            newspaper_name="The Gazette PDF",
            publication_date=date(2026, 11, 15),
            page_count=4,
            has_qr=False,
        )
        db.session.add(ed3)
        db.session.commit()

        art3 = Article(
            edition_id=seed_test_data["edition2"].id,
            category="Sports",
            headline="Championship Finals",
            content="Full sports coverage...",
            duration_seconds=200,
            page_number=4,
            is_headline=False,
        )
        db.session.add(art3)
        db.session.commit()

        ed1_id = str(seed_test_data["edition1"].id)
        ed2_id = str(seed_test_data["edition2"].id)
        ed3_id = str(ed3.id)
        art1_id = str(seed_test_data["art1"].id)
        art2_id = str(seed_test_data["art2"].id)
        art3_id = str(art3.id)

    # 1. Authenticate User A and User B via /api/auth/login
    login_a = client.post("/api/auth/login", json={"email": "usera@dailyvoice.com"}).get_json()
    token_a = login_a["session"]["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    login_b = client.post("/api/auth/login", json={"email": "userb@dailyvoice.com"}).get_json()
    token_b = login_b["session"]["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    assert login_a["user"]["id"] != login_b["user"]["id"]

    # 2. User A activities
    client.post("/api/user/editions", headers=headers_a, json={"edition_id": ed1_id, "source": "qr_scan"})
    client.post("/api/user/editions", headers=headers_a, json={"edition_id": ed3_id, "source": "pdf_upload"})
    client.post("/api/bookmarks", headers=headers_a, json={"article_id": art1_id})
    client.post("/api/bookmarks", headers=headers_a, json={"article_id": art2_id})
    # Partial listen on art1
    client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art1_id,
            "edition_id": ed1_id,
            "listening_mode": "summary",
            "language": "English",
            "progress_seconds": 65.0,
            "duration_seconds": 180,
            "is_completed": False,
        },
    )
    # Completed listen on art2
    client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art2_id,
            "edition_id": ed1_id,
            "listening_mode": "full",
            "language": "Hindi",
            "progress_seconds": 240.0,
            "duration_seconds": 240,
            "is_completed": True,
        },
    )

    # 3. User B activities
    client.post("/api/user/editions", headers=headers_b, json={"edition_id": ed2_id, "source": "qr_scan"})
    client.post("/api/bookmarks", headers=headers_b, json={"article_id": art3_id})
    client.post(
        "/api/history",
        headers=headers_b,
        json={
            "article_id": art3_id,
            "edition_id": ed2_id,
            "listening_mode": "summary",
            "language": "Kannada",
            "progress_seconds": 30.0,
            "duration_seconds": 200,
            "is_completed": False,
        },
    )

    # 4. Simulate User A Logout & Re-login
    relogin_a = client.post("/api/auth/login", json={"email": "usera@dailyvoice.com"}).get_json()
    headers_a2 = {"Authorization": f"Bearer {relogin_a['session']['access_token']}"}

    # Verify User A sees ONLY User A's data
    a_editions = client.get("/api/user/editions", headers=headers_a2).get_json()
    assert a_editions["count"] == 2
    a_ed_ids = {ed["id"] for ed in a_editions["data"]}
    assert a_ed_ids == {ed1_id, ed3_id}
    assert ed2_id not in a_ed_ids

    a_bookmarks = client.get("/api/bookmarks", headers=headers_a2).get_json()
    assert a_bookmarks["count"] == 2
    assert set(a_bookmarks["saved_article_ids"]) == {art1_id, art2_id}
    assert art3_id not in a_bookmarks["saved_article_ids"]

    a_history = client.get("/api/history", headers=headers_a2).get_json()
    assert a_history["count"] == 2
    a_hist_by_art = {h["articleId"]: h for h in a_history["history"]}
    assert a_hist_by_art[art1_id]["isCompleted"] is False
    assert a_hist_by_art[art1_id]["progressSeconds"] == 65.0
    assert a_hist_by_art[art1_id]["listeningMode"] == "summary"
    assert a_hist_by_art[art1_id]["language"] == "English"
    assert a_hist_by_art[art2_id]["isCompleted"] is True
    assert a_hist_by_art[art2_id]["listeningMode"] == "full"
    assert a_hist_by_art[art2_id]["language"] == "Hindi"

    a_stats = client.get("/api/history/stats", headers=headers_a2).get_json()["stats"]
    assert a_stats["total_completed"] == 1
    assert a_stats["total_in_progress"] == 1
    assert a_stats["total_sessions"] == 2

    # 5. Simulate User B Logout & Re-login
    relogin_b = client.post("/api/auth/login", json={"email": "userb@dailyvoice.com"}).get_json()
    headers_b2 = {"Authorization": f"Bearer {relogin_b['session']['access_token']}"}

    # Verify User B sees ONLY User B's data
    b_editions = client.get("/api/user/editions", headers=headers_b2).get_json()
    assert b_editions["count"] == 1
    assert b_editions["data"][0]["id"] == ed2_id

    b_bookmarks = client.get("/api/bookmarks", headers=headers_b2).get_json()
    assert b_bookmarks["count"] == 1
    assert b_bookmarks["saved_article_ids"] == [art3_id]

    b_history = client.get("/api/history", headers=headers_b2).get_json()
    assert b_history["count"] == 1
    assert b_history["history"][0]["articleId"] == art3_id
    assert b_history["history"][0]["language"] == "Kannada"

    b_stats = client.get("/api/history/stats", headers=headers_b2).get_json()["stats"]
    assert b_stats["total_completed"] == 0
    assert b_stats["total_in_progress"] == 1
    assert b_stats["total_sessions"] == 1

    # 6. Verify User B cannot delete User A's edition or bookmark
    client.delete(f"/api/user/editions/{ed1_id}", headers=headers_b2)
    client.delete(f"/api/bookmarks/{art1_id}", headers=headers_b2)

    # Confirm User A's records are completely untouched
    assert client.get("/api/user/editions", headers=headers_a2).get_json()["count"] == 2
    assert client.get("/api/bookmarks", headers=headers_a2).get_json()["count"] == 2


# -------------------------------------------------------------------------
# CORS Preflight & Dashboard Statistics Scenarios A-E
# -------------------------------------------------------------------------

def test_cors_preflight_allows_auth_and_content_type_headers(client):
    """
    Verifies CORS OPTIONS preflight succeeds for bookmarks, history, stats, and editions
    when frontend sends standard Authorization + Content-Type headers.
    """
    endpoints = [
        ("/api/bookmarks", "GET"),
        ("/api/bookmarks", "POST"),
        ("/api/bookmarks/toggle", "POST"),
        ("/api/history", "GET"),
        ("/api/history", "POST"),
        ("/api/history/stats", "GET"),
        ("/api/user/editions", "GET"),
        ("/api/user/editions", "POST"),
    ]
    for path, method in endpoints:
        res = client.options(
            path,
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "authorization, content-type",
            },
        )
        assert res.status_code in (200, 204), f"OPTIONS {path} failed with {res.status_code}"
        allowed = (res.headers.get("Access-Control-Allow-Headers") or "").lower()
        assert "authorization" in allowed, f"Authorization not allowed on {path}"
        assert res.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"


def test_dashboard_statistics_scenarios_a_through_e(client, app, seed_test_data):
    """
    Verifies all five exact Dashboard Statistics scenarios:
    - Scenario A: Start article, listen 14s, pause -> Time Today: 14s, In Progress: 1, Completed: 0.
      Repeated updates / pausing / seeking do not inflate Time Today or falsely complete.
    - Scenario B: Resume and complete (+30s) -> Time Today: 44s, In Progress: 0, Completed: 1.
    - Scenario C: Start 2nd article and listen 20s -> Time Today: 1m 4s, In Progress: 1, Completed: 1.
    - Scenario D: Refresh + logout/login same account -> All 3 stats & bookmarks survive.
      Local calendar day rollover resets Time Today to 0m without losing Completed/In Progress.
    - Scenario E: Switch to another account -> Only that account's statistics appear.
    """
    art1_id = str(seed_test_data["art1"].id)
    art2_id = str(seed_test_data["art2"].id)
    ed1_id = str(seed_test_data["edition1"].id)
    today_local = "2026-11-17"
    tomorrow_local = "2026-11-18"

    # Log in as User A
    login_a = client.post("/api/auth/login", json={"email": "stats-user-a@dailyvoice.com"}).get_json()
    headers_a = {"Authorization": f"Bearer {login_a['session']['access_token']}"}

    # Also bookmark 2 articles via toggle endpoint
    bm1 = client.post("/api/bookmarks/toggle", headers=headers_a, json={"article_id": art1_id})
    bm2 = client.post("/api/bookmarks/toggle", headers=headers_a, json={"article_id": art2_id})
    assert bm1.status_code == 200 and bm1.get_json()["bookmarked"] is True
    assert bm2.status_code == 200 and bm2.get_json()["bookmarked"] is True

    # --- Scenario A: Start article (0s listened) -> In Progress immediately 1, Time Today 0m ---
    start_res = client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art1_id,
            "edition_id": ed1_id,
            "progress_seconds": 0.0,
            "duration_seconds": 44,
            "listened_delta_seconds": 0.0,
            "local_date": today_local,
            "is_completed": False,
        },
    )
    assert start_res.status_code == 200
    stats = start_res.get_json()["stats"]
    assert stats["time_today_display"] == "0m"
    assert stats["total_in_progress"] == 1
    assert stats["total_completed"] == 0

    # Listen for 5s, then 5s, then 4s and pause (total 14s actual playback)
    for pos, delta in [(5.0, 5.0), (10.0, 5.0), (14.0, 4.0)]:
        r = client.post(
            "/api/history",
            headers=headers_a,
            json={
                "article_id": art1_id,
                "edition_id": ed1_id,
                "progress_seconds": pos,
                "duration_seconds": 44,
                "listened_delta_seconds": delta,
                "local_date": today_local,
                "is_completed": False,
            },
        )
        assert r.status_code == 200

    # Repeated pause/sync with 0 delta must NOT double-count
    dup_res = client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art1_id,
            "edition_id": ed1_id,
            "progress_seconds": 14.0,
            "duration_seconds": 44,
            "listened_delta_seconds": 0.0,
            "local_date": today_local,
            "is_completed": False,
        },
    )
    stats_a = dup_res.get_json()["stats"]
    assert stats_a["time_today_seconds"] == 14.0
    assert stats_a["time_today_display"] == "14s"
    assert stats_a["total_in_progress"] == 1
    assert stats_a["total_completed"] == 0

    # Seeking to 42s / 44s with is_completed=False and delta=0 must NOT inflate Time Today or complete
    seek_res = client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art1_id,
            "edition_id": ed1_id,
            "progress_seconds": 42.0,
            "duration_seconds": 44,
            "listened_delta_seconds": 0.0,
            "local_date": today_local,
            "is_completed": False,
        },
    )
    stats_seek = seek_res.get_json()["stats"]
    assert stats_seek["time_today_seconds"] == 14.0
    assert stats_seek["total_completed"] == 0
    assert stats_seek["total_in_progress"] == 1

    # --- Scenario B: Resume and complete (+30s actual listening -> total 44s) ---
    comp_res = client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art1_id,
            "edition_id": ed1_id,
            "progress_seconds": 44.0,
            "duration_seconds": 44,
            "listened_delta_seconds": 30.0,
            "local_date": today_local,
            "is_completed": True,
        },
    )
    stats_b = comp_res.get_json()["stats"]
    assert stats_b["time_today_seconds"] == 44.0
    assert stats_b["time_today_display"] == "44s"
    assert stats_b["total_in_progress"] == 0
    assert stats_b["total_completed"] == 1

    # Replaying a completed article with is_completed=False keeps completion sticky
    replay_res = client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art1_id,
            "edition_id": ed1_id,
            "progress_seconds": 0.0,
            "duration_seconds": 44,
            "listened_delta_seconds": 0.0,
            "local_date": today_local,
            "is_completed": False,
        },
    )
    assert replay_res.get_json()["stats"]["total_completed"] == 1
    assert replay_res.get_json()["stats"]["total_in_progress"] == 0

    # --- Scenario C: Start 2nd article and listen partially (20s) ---
    art2_res = client.post(
        "/api/history",
        headers=headers_a,
        json={
            "article_id": art2_id,
            "edition_id": ed1_id,
            "progress_seconds": 20.0,
            "duration_seconds": 240,
            "listened_delta_seconds": 20.0,
            "local_date": today_local,
            "is_completed": False,
        },
    )
    stats_c = art2_res.get_json()["stats"]
    assert stats_c["time_today_seconds"] == 64.0
    assert stats_c["time_today_display"] == "1m 4s"
    assert stats_c["total_in_progress"] == 1
    assert stats_c["total_completed"] == 1

    # --- Scenario D: Logout & login again with the same account ---
    relogin_a = client.post("/api/auth/login", json={"email": "stats-user-a@dailyvoice.com"}).get_json()
    headers_a2 = {"Authorization": f"Bearer {relogin_a['session']['access_token']}"}

    stats_d = client.get(f"/api/history/stats?local_date={today_local}", headers=headers_a2).get_json()["stats"]
    assert stats_d["time_today_seconds"] == 64.0
    assert stats_d["time_today_display"] == "1m 4s"
    assert stats_d["total_in_progress"] == 1
    assert stats_d["total_completed"] == 1

    hist_d = client.get("/api/history", headers=headers_a2).get_json()
    assert hist_d["count"] == 2

    bm_d = client.get("/api/bookmarks", headers=headers_a2).get_json()
    assert bm_d["count"] == 2
    assert set(bm_d["saved_article_ids"]) == {art1_id, art2_id}

    # Verify daily reset on next local calendar day
    stats_next_day = client.get(f"/api/history/stats?local_date={tomorrow_local}", headers=headers_a2).get_json()["stats"]
    assert stats_next_day["time_today_seconds"] == 0.0
    assert stats_next_day["time_today_display"] == "0m"
    assert stats_next_day["total_completed"] == 1
    assert stats_next_day["total_in_progress"] == 1

    # --- Scenario E: Log in using another account (User B) ---
    login_b = client.post("/api/auth/login", json={"email": "stats-user-b@dailyvoice.com"}).get_json()
    headers_b = {"Authorization": f"Bearer {login_b['session']['access_token']}"}

    stats_e = client.get(f"/api/history/stats?local_date={today_local}", headers=headers_b).get_json()["stats"]
    assert stats_e["time_today_seconds"] == 0.0
    assert stats_e["time_today_display"] == "0m"
    assert stats_e["total_completed"] == 0
    assert stats_e["total_in_progress"] == 0
    assert client.get("/api/bookmarks", headers=headers_b).get_json()["count"] == 0
    assert client.get("/api/history", headers=headers_b).get_json()["count"] == 0
