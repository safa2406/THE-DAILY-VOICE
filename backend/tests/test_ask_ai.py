import uuid
import pytest
from unittest.mock import MagicMock
from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article
from tests.test_auth_middleware import create_hs256_token


@pytest.fixture
def sample_article_for_ai(app):
    """Fixture to create a sample edition and article in the test database."""
    with app.app_context():
        edition = Edition(
            id=str(uuid.uuid4()),
            edition_code="ED-AI-001",
            newspaper_name="The Daily Voice Herald",
            publication_date=pytest.importorskip("datetime").date(2026, 11, 19),
            location="National Edition",
            weather="Mild 20°C",
            page_count=5,
        )
        article = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            category="Current Affairs",
            headline="Global Clean Energy Summit Concludes with $50B Maritime Accord in Kochi",
            byline="Staff Correspondent, Kochi",
            page_number=1,
            summary="Thirty maritime nations signed a $50 billion accord in Kochi to protect critical Indian Ocean sea lanes and invest in renewable shipping.",
            content=(
                "Thirty maritime nations concluded a historic four-day summit in Kochi yesterday, "
                "signing a landmark $50 billion treaty to protect Indian Ocean ecological corridors "
                "and deploy electric cargo ships by 2030. The treaty was led by India's Ministry of Ports "
                "and endorsed by international observers. Ministers emphasized that maritime biodiversity "
                "and zero-emission transit are central to sustainable commerce."
            ),
            duration_seconds=120,
            is_headline=True,
        )
        db.session.add(edition)
        db.session.add(article)
        db.session.commit()
        return {
            "edition_id": edition.id,
            "article_id": article.id,
            "headline": article.headline,
        }


def test_ask_ai_requires_authentication(client, sample_article_for_ai):
    """Rejects unauthenticated requests with 401 and AUTH_HEADER_MISSING."""
    art_id = sample_article_for_ai["article_id"]
    res = client.post(f"/api/articles/{art_id}/ask", json={"question": "What is this article about?"})
    assert res.status_code == 401
    data = res.get_json()
    assert data["code"] == "AUTH_HEADER_MISSING"


def test_ask_ai_rejects_nonexistent_article(client, sample_article_for_ai):
    """Rejects requests for non-existent articles with 404 ARTICLE_NOT_FOUND."""
    token = create_hs256_token()
    non_existent_id = str(uuid.uuid4())
    res = client.post(
        f"/api/articles/{non_existent_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "What is happening?"},
    )
    assert res.status_code == 404
    data = res.get_json()
    assert data["code"] == "ARTICLE_NOT_FOUND"


def test_ask_ai_rejects_empty_question(client, sample_article_for_ai):
    """Rejects empty or whitespace-only questions with 400 EMPTY_QUESTION."""
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]
    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "   "},
    )
    assert res.status_code == 400
    data = res.get_json()
    assert data["code"] == "EMPTY_QUESTION"


def test_ask_ai_rejects_excessively_long_question(client, sample_article_for_ai):
    """Rejects questions exceeding 1000 characters with 400 QUESTION_TOO_LONG."""
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]
    long_q = "Why? " * 300  # 1500 chars
    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": long_q},
    )
    assert res.status_code == 400
    data = res.get_json()
    assert data["code"] == "QUESTION_TOO_LONG"


def test_ask_ai_rejects_unsupported_language(client, sample_article_for_ai):
    """Rejects unsupported languages with 400 UNSUPPORTED_LANGUAGE."""
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]
    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "What is the treaty value?", "language": "Spanish"},
    )
    assert res.status_code == 400
    data = res.get_json()
    assert data["code"] == "UNSUPPORTED_LANGUAGE"


def test_ask_ai_missing_groq_api_key_returns_503(client, sample_article_for_ai, monkeypatch):
    """When GROQ_API_KEY is not configured, returns 503 and never returns fabricated fallback."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]

    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "Who signed the accord?"},
    )
    assert res.status_code == 503
    data = res.get_json()
    assert data["code"] == "AI_CONFIG_MISSING"
    assert "GROQ_API_KEY" in data["message"]


def test_ask_ai_successful_english_question(client, sample_article_for_ai, monkeypatch):
    """Successfully answers question in English using article context and Groq."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_mock_key_12345")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]

    captured_kwargs = {}

    class MockCompletion:
        class Choice:
            class Message:
                content = (
                    "According to the article, thirty maritime nations concluded a four-day summit "
                    "in Kochi and signed a $50 billion accord to protect Indian Ocean ecological corridors. "
                    "The initiative was spearheaded by India's Ministry of Ports."
                )
            message = Message()
        choices = [Choice()]

    class MockClient:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    nonlocal captured_kwargs
                    captured_kwargs = kwargs
                    return MockCompletion()

    monkeypatch.setattr("groq.Groq", lambda api_key: MockClient())

    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "What is the key takeaway of the Kochi accord?", "language": "English"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert "fifty billion" in data["data"]["answer"].lower() or "$50 billion" in data["data"]["answer"]
    assert data["data"]["language"] == "English"
    assert data["data"]["article_id"] == art_id

    # Verify context passed to Groq
    messages = captured_kwargs.get("messages", [])
    system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
    assert "The Daily Voice Herald" in system_msg
    assert "Kochi" in system_msg
    assert "Fifty billion" in system_msg or "$50 billion" in system_msg
    assert "CRITICAL RULES AND BEHAVIOR" in system_msg or "CORE EDITORIAL GUIDELINES" in system_msg

    # User message check
    user_msg = next((m["content"] for m in messages if m["role"] == "user"), "")
    assert user_msg == "What is the key takeaway of the Kochi accord?"


def test_ask_ai_multilingual_hindi_kannada_telugu_marathi(client, sample_article_for_ai, monkeypatch):
    """Tests multilingual support for Hindi, Kannada, Telugu, and Marathi."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_mock_key_12345")
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]

    for lang in ["Hindi", "Kannada", "Telugu", "Marathi"]:
        captured_messages = []

        class MockCompletion:
            class Choice:
                class Message:
                    content = f"Mocked authentic response in {lang}."
                message = Message()
            choices = [Choice()]

        class MockClient:
            class chat:
                class completions:
                    @staticmethod
                    def create(**kwargs):
                        nonlocal captured_messages
                        captured_messages = kwargs.get("messages", [])
                        return MockCompletion()

        monkeypatch.setattr("groq.Groq", lambda api_key: MockClient())

        res = client.post(
            f"/api/articles/{art_id}/ask",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Explain this in my language", "language": lang},
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["data"]["language"] == lang

        sys_msg = captured_messages[0]["content"]
        assert lang in sys_msg


def test_ask_ai_follow_up_questions_with_history(client, sample_article_for_ai, monkeypatch):
    """Maintains multi-turn conversation history for contextual follow-up questions."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_mock_key_12345")
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]

    captured_messages = []

    class MockCompletion:
        class Choice:
            class Message:
                content = "The summit lasted four days and took place in Kochi, Kerala."
            message = Message()
        choices = [Choice()]

    class MockClient:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    nonlocal captured_messages
                    captured_messages = kwargs.get("messages", [])
                    return MockCompletion()

    monkeypatch.setattr("groq.Groq", lambda api_key: MockClient())

    history = [
        {"role": "user", "content": "What was announced?"},
        {"role": "assistant", "content": "A $50B maritime agreement was signed by 30 nations in Kochi."},
    ]

    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question": "How long did it last and where?",
            "history": history,
            "language": "English",
        },
    )
    assert res.status_code == 200

    # Ensure previous history is injected into Groq messages
    roles = [m["role"] for m in captured_messages]
    assert roles == ["system", "user", "assistant", "user"]
    assert captured_messages[1]["content"] == "What was announced?"
    assert captured_messages[2]["content"] == "A $50B maritime agreement was signed by 30 nations in Kochi."
    assert captured_messages[3]["content"] == "How long did it last and where?"


def test_ask_ai_cors_options_preflight(client, sample_article_for_ai):
    """Verifies that CORS preflight OPTIONS requests succeed with 204 and CORS headers without auth."""
    art_id = sample_article_for_ai["article_id"]
    res = client.open(
        f"/api/articles/{art_id}/ask",
        method="OPTIONS",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert res.status_code == 204
    assert res.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert "POST" in res.headers.get("Access-Control-Allow-Methods", "")


def test_ask_ai_rate_limit_handling(client, sample_article_for_ai, monkeypatch):
    """When Groq returns rate limit error (429), returns 429 AI_RATE_LIMIT."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_mock_key_12345")
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]

    class MockClient:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    raise RuntimeError("Groq 429: Rate limit exceeded")

    monkeypatch.setattr("groq.Groq", lambda api_key: MockClient())

    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "What is the treaty value?"},
    )
    assert res.status_code == 429
    data = res.get_json()
    assert data["code"] == "AI_RATE_LIMIT"
    assert "rate limit" in data["message"].lower()


def test_ask_ai_error_handling_when_groq_fails(client, sample_article_for_ai, monkeypatch):
    """When Groq fails with a server error, returns 500 AI_SERVICE_ERROR and never fake answers."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_mock_key_12345")
    token = create_hs256_token()
    art_id = sample_article_for_ai["article_id"]

    class MockClient:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    raise RuntimeError("Internal Groq cluster failure")

    monkeypatch.setattr("groq.Groq", lambda api_key: MockClient())

    res = client.post(
        f"/api/articles/{art_id}/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "What is the treaty value?"},
    )
    assert res.status_code == 500
    data = res.get_json()
    assert data["code"] == "AI_SERVICE_ERROR"
    assert "Internal Groq cluster failure" in data["message"]


def test_audio_synthesize_endpoint(client, monkeypatch):
    """Tests POST /api/audio/synthesize for AI answer playback."""
    synthesized_calls = []

    def mock_synthesize(text, language, output_path):
        synthesized_calls.append((text, language, output_path))
        # Create an empty file to simulate audio generation
        with open(output_path, "wb") as f:
            f.write(b"ID3_fake_mp3_content")
        return {"provider": "mock", "duration_seconds": 5}

    monkeypatch.setattr("app.routes.audio.synthesize_speech", mock_synthesize)

    # 1. Successful synthesis
    res = client.post(
        "/api/audio/synthesize",
        json={"text": "This is the AI response to be spoken aloud.", "language": "English"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["data"]["audio_url"].startswith("/api/audio/stream/ai_resp_")

    # 2. Empty text rejected
    res_empty = client.post("/api/audio/synthesize", json={"text": ""})
    assert res_empty.status_code == 400

    # 3. Unsupported language rejected
    res_lang = client.post("/api/audio/synthesize", json={"text": "Hello", "language": "Russian"})
    assert res_lang.status_code == 400
