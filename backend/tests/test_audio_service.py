import os
import uuid
from datetime import date
import pytest
from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article
from app.models.audio_cache import AudioCache
from app.services.tts_service import SUPPORTED_LANGUAGES, get_voice_for_language
from app.services.audio_manager import compute_content_hash
from app.services.ai_service import (
    generate_article_summary,
    translate_text,
    generate_headlines_script,
    validate_indic_text,
)

SAMPLE_ARTICLE_CONTENT = """
India launched its premier deep-space exploration mission today from the Satish Dhawan Space Centre in Sriharikota. 
The spacecraft, named Samudra-1, aims to analyze mineral concentrations and sub-surface seismic activity. 
Dr. K. Sivan, chief science advisor, confirmed that all telemetry systems and solid-fuel boosters functioned flawlessly 
during the 18-minute insertion phase. Over 450 scientists monitored the launch in real-time. 
The probe will travel for 11 months across 400 million kilometers before entering Martian orbit. 
International space agencies including NASA and ESA extended formal congratulations to the Indian team.
"""

@pytest.fixture
def sample_edition_and_articles(app):
    """Seed test database with an edition and two sample articles."""
    with app.app_context():
        edition = Edition(
            id=str(uuid.uuid4()),
            edition_code="ED-TEST-01",
            newspaper_name="The Daily Voice - National Edition",
            publication_date=date(2026, 11, 17),
            page_count=2,
            location="National Broadsheet",
            weather="18°C Mild",
        )
        db.session.add(edition)

        art1 = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            headline="India Launches Deep-Space Exploration Mission from Sriharikota",
            content=SAMPLE_ARTICLE_CONTENT,
            page_number=1,
            category="Science & Technology",
            byline="The Daily Voice Science Desk",
            is_headline=True,
        )
        art2 = Article(
            id=str(uuid.uuid4()),
            edition_id=edition.id,
            headline="Stock Indices Reach All-Time High Led by Tech and Infrastructure",
            content="Equity benchmarks surged past historic barriers on Tuesday as foreign institutional investments and robust corporate earnings bolstered investor confidence across mid-cap and heavy industrial portfolios.",
            page_number=2,
            category="Finance",
            byline="Financial Bureau",
            is_headline=False,
        )
        db.session.add_all([art1, art2])
        db.session.commit()

        yield {
            "edition": edition,
            "article1": art1,
            "article2": art2,
        }


def test_get_supported_languages(client):
    """Verify GET /api/audio/languages returns 5 verified languages with English as default."""
    res = client.get("/api/audio/languages")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    languages = data["data"]

    assert len(languages) == 5
    lang_ids = [l["id"] for l in languages]
    assert "English" in lang_ids
    assert "Hindi" in lang_ids
    assert "Kannada" in lang_ids
    assert "Telugu" in lang_ids
    assert "Marathi" in lang_ids

    # Verify English is default
    english = next(l for l in languages if l["id"] == "English")
    assert english["is_default"] is True
    assert english["voice"] == "en-IN-NeerjaNeural"

    # Verify native voices
    hindi = next(l for l in languages if l["id"] == "Hindi")
    assert hindi["voice"] == "hi-IN-SwaraNeural"

    kannada = next(l for l in languages if l["id"] == "Kannada")
    assert kannada["voice"] == "kn-IN-GaganNeural"

    telugu = next(l for l in languages if l["id"] == "Telugu")
    assert telugu["voice"] == "te-IN-ShrutiNeural"

    marathi = next(l for l in languages if l["id"] == "Marathi")
    assert marathi["voice"] == "mr-IN-AarohiNeural"


def test_generate_audio_validation_errors(client):
    """Verify endpoint rejects invalid payloads with 400 Bad Request."""
    # Empty payload
    res = client.post("/api/audio/generate", json={})
    assert res.status_code == 400

    # Invalid mode
    res = client.post(
        "/api/audio/generate",
        json={"article_id": "dummy", "mode": "invalid_mode", "language": "English"},
    )
    assert res.status_code == 400

    # Unsupported language
    res = client.post(
        "/api/audio/generate",
        json={"article_id": "dummy", "mode": "summary", "language": "Spanish"},
    )
    assert res.status_code == 400


def test_ai_summary_generation_properties():
    """Verify extractive/factual summarizer creates concise ~30-45s listening length."""
    summary = generate_article_summary(
        headline="India Launches Deep-Space Exploration Mission from Sriharikota",
        content=SAMPLE_ARTICLE_CONTENT,
    )
    assert summary is not None
    assert len(summary) > 40
    # Summary should be concise (~50 - 120 words) for 30-45s audio
    words = summary.split()
    assert 15 <= len(words) <= 150
    # Must preserve essential facts
    assert any(term in summary for term in ["India", "Sriharikota", "Satish Dhawan", "Samudra-1", "space"])


def test_headlines_script_generation(sample_edition_and_articles):
    """Verify headlines script generator only includes headlines and edition title."""
    edition = sample_edition_and_articles["edition"]
    articles = [sample_edition_and_articles["article1"], sample_edition_and_articles["article2"]]

    script = generate_headlines_script(edition.newspaper_name, articles)
    assert edition.newspaper_name in script
    assert "India Launches Deep-Space Exploration Mission" in script
    assert "Stock Indices Reach All-Time High" in script
    # Should NOT contain full article bodies
    assert "400 million kilometers before entering Martian orbit" not in script


def test_generate_audio_summary_and_caching(client, sample_edition_and_articles, monkeypatch):
    """Verify summary generation, audio file creation, and caching on subsequent requests."""
    art = sample_edition_and_articles["article1"]

    dummy_mp3 = b"\xff\xfb\x90\x00" * 256  # Minimal valid MP3 header bytes

    def mock_synthesize(text, language="English", output_path=None):
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(dummy_mp3)
        return {
            "voice": "en-IN-NeerjaNeural",
            "file_size_bytes": len(dummy_mp3),
            "duration_seconds": 35.0,
            "provider": "edge-tts",
        }

    monkeypatch.setattr("app.services.audio_manager.synthesize_speech", mock_synthesize)

    # 1. First generation: cache miss
    payload = {
        "article_id": art.id,
        "mode": "summary",
        "language": "English",
    }
    res1 = client.post("/api/audio/generate", json=payload)
    assert res1.status_code == 200
    data1 = res1.get_json()["data"]

    assert data1["cached"] is False
    assert data1["mode"] == "summary"
    assert data1["language"] == "English"
    assert data1["duration_seconds"] == 35.0
    assert "/api/audio/stream/" in data1["audio_url"]
    assert len(data1["text"]) > 0

    # 2. Second generation: cache hit
    res2 = client.post("/api/audio/generate", json=payload)
    assert res2.status_code == 200
    data2 = res2.get_json()["data"]

    assert data2["cached"] is True
    assert data2["audio_url"] == data1["audio_url"]
    assert data2["content_hash"] == data1["content_hash"]


def test_generate_full_article_audio(client, sample_edition_and_articles, monkeypatch):
    """Verify full article narration reads unabridged content."""
    art = sample_edition_and_articles["article1"]

    def mock_synthesize(text, language="English", output_path=None):
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(b"dummy-full-audio")
        return {
            "voice": "en-IN-NeerjaNeural",
            "file_size_bytes": 16,
            "duration_seconds": 180.0,
            "provider": "edge-tts",
        }

    monkeypatch.setattr("app.services.audio_manager.synthesize_speech", mock_synthesize)

    payload = {
        "article_id": art.id,
        "mode": "full",
        "language": "English",
    }
    res = client.post("/api/audio/generate", json=payload)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["mode"] == "full"
    # Full article text should contain the unabridged paragraph
    assert "Satish Dhawan Space Centre" in data["text"]


def test_generate_headlines_edition_audio(client, sample_edition_and_articles, monkeypatch):
    """Verify headlines mode reads edition headlines."""
    edition = sample_edition_and_articles["edition"]

    def mock_synthesize(text, language="English", output_path=None):
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(b"dummy-headlines-audio")
        return {
            "voice": "en-IN-NeerjaNeural",
            "file_size_bytes": 20,
            "duration_seconds": 45.0,
            "provider": "edge-tts",
        }

    monkeypatch.setattr("app.services.audio_manager.synthesize_speech", mock_synthesize)

    payload = {
        "edition_id": edition.id,
        "mode": "headlines",
        "language": "English",
    }
    res = client.post("/api/audio/generate", json=payload)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["mode"] == "headlines"
    assert "India Launches Deep-Space" in data["text"]


def test_translation_preserves_original_english_in_db(client, sample_edition_and_articles, monkeypatch):
    """Verify translation produces translated audio without altering English text in DB."""
    art = sample_edition_and_articles["article1"]
    original_english = art.content

    # Mock translation
    def mock_translate(text, target_lang):
        return "भारत ने आज श्रीहरिकोटा से अपने पहले गहरे अंतरिक्ष मिशन का शुभारंभ किया।"

    monkeypatch.setattr("app.services.audio_manager.translate_text", mock_translate)

    def mock_synthesize(text, language="Hindi", output_path=None):
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(b"hindi-audio")
        return {
            "voice": "hi-IN-SwaraNeural",
            "file_size_bytes": 11,
            "duration_seconds": 32.0,
            "provider": "edge-tts",
        }

    monkeypatch.setattr("app.services.audio_manager.synthesize_speech", mock_synthesize)

    res = client.post(
        "/api/audio/generate",
        json={"article_id": art.id, "mode": "summary", "language": "Hindi"},
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["language"] == "Hindi"
    assert "भारत ने आज" in data["text"]

    # Verify database record remains original English!
    reloaded_art = db.session.get(Article, art.id)
    assert reloaded_art.content == original_english
    assert "भारत ने आज" not in reloaded_art.content


def test_audio_stream_endpoint_range(client, sample_edition_and_articles, monkeypatch):
    """Verify /api/audio/stream/<filename> supports HTTP 200 and HTTP 206 partial range streaming."""
    art = sample_edition_and_articles["article1"]
    test_audio_bytes = b"0123456789ABCDEF" * 16  # 256 bytes

    def mock_synthesize(text, language="English", output_path=None):
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(test_audio_bytes)
        return {
            "voice": "en-IN-NeerjaNeural",
            "file_size_bytes": len(test_audio_bytes),
            "duration_seconds": 10.0,
            "provider": "edge-tts",
        }

    monkeypatch.setattr("app.services.audio_manager.synthesize_speech", mock_synthesize)

    gen_res = client.post(
        "/api/audio/generate",
        json={"article_id": art.id, "mode": "summary", "language": "English"},
    )
    assert gen_res.status_code == 200
    audio_url = gen_res.get_json()["data"]["audio_url"]
    filename = audio_url.split("/")[-1]

    # Full request (HTTP 200)
    stream_res = client.get(f"/api/audio/stream/{filename}")
    assert stream_res.status_code == 200
    assert stream_res.content_type == "audio/mpeg"
    assert stream_res.data == test_audio_bytes

    # Partial Range request (HTTP 206)
    range_res = client.get(
        f"/api/audio/stream/{filename}",
        headers={"Range": "bytes=0-15"},
    )
    assert range_res.status_code == 206
    assert range_res.headers.get("Content-Range") == "bytes 0-15/256"
    assert len(range_res.data) == 16
    assert range_res.data == test_audio_bytes[0:16]


def test_validate_indic_text_detection():
    """Verify validate_indic_text correctly identifies Indic scripts and rejects English or cross-script text."""
    hindi_sample = "भारत ने आज श्रीहरिकोटा से अपने पहले गहरे अंतरिक्ष मिशन का शुभारंभ किया।"
    kannada_sample = "ಭಾರತ ಇಂದು ಶ್ರೀಹರಿಕೋಟಾದಿಂದ ತನ್ನ ಪ್ರಮುಖ ಆಳ ಬಾಹ್ಯಾಕಾಶ ಪರಿಶೋಧನಾ ಕಾರ್ಯಾಚರಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿತು."
    telugu_sample = "భారతదేశం నేడు శ్రీహరికోట నుండి తన ప్రధాన లోతైన అంతరిక్ష పరిశోధన మిషన్‌ను ప్రారంభించింది."
    marathi_sample = "भारताने आज श्रीहरिकोटा येथून आपल्या पहिल्या खोल अंतराळ मोहिमेचा प्रारंभ केला."
    english_sample = "India launched its premier deep-space exploration mission today."

    # Authentic Indic scripts should pass
    valid, ratio = validate_indic_text(hindi_sample, "Hindi")
    assert valid is True and ratio > 0.50

    valid, ratio = validate_indic_text(kannada_sample, "Kannada")
    assert valid is True and ratio > 0.50

    valid, ratio = validate_indic_text(telugu_sample, "Telugu")
    assert valid is True and ratio > 0.50

    valid, ratio = validate_indic_text(marathi_sample, "Marathi")
    assert valid is True and ratio > 0.50

    # English text passed to Indic language MUST fail
    valid, ratio = validate_indic_text(english_sample, "Hindi")
    assert valid is False and ratio == 0.0

    valid, ratio = validate_indic_text(english_sample, "Kannada")
    assert valid is False and ratio == 0.0

    valid, ratio = validate_indic_text(english_sample, "Telugu")
    assert valid is False and ratio == 0.0

    valid, ratio = validate_indic_text(english_sample, "Marathi")
    assert valid is False and ratio == 0.0

    # English passed for English should pass
    valid, ratio = validate_indic_text(english_sample, "English")
    assert valid is True and ratio == 1.0


def test_translation_failure_raises_and_never_falls_back_to_english(monkeypatch):
    """Verify translation engine raises ValueError if all tiers fail, never silently returning English."""
    from app.services.ai_service import _TRANSLATION_MEM_CACHE
    _TRANSLATION_MEM_CACHE.clear()

    # Disable Groq and force Google GTX fallback translation to fail
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setattr("app.services.ai_service._translate_google_gtx", lambda *args, **kwargs: "")

    with pytest.raises(ValueError, match="Unable to translate article into Hindi"):
        translate_text("Unique text that cannot be translated anywhere.", target_language="Hindi")


def test_independent_translation_caching(monkeypatch):
    """Verify translations are cached independently of audio and reused on identical text."""
    from app.services.ai_service import (
        translate_text,
        _TRANSLATION_MEM_CACHE,
    )
    _TRANSLATION_MEM_CACHE.clear()

    hindi_text = "भारत का पहला गहन अंतरिक्ष मिशन सफलतापूर्वक शुरू हुआ।"
    call_count = 0

    def mock_gtx(text, code, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        return hindi_text

    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setattr("app.services.ai_service._translate_google_gtx", mock_gtx)

    sample = f"India launched its premier deep-space exploration mission {uuid.uuid4()}."

    # First call: calls translator
    t1 = translate_text(sample, "Hindi")
    assert t1 == hindi_text
    assert call_count == 1

    # Second call with identical article text and language: must reuse cache, no translator call
    t2 = translate_text(sample, "Hindi")
    assert t2 == hindi_text
    assert call_count == 1  # Still 1! Zero extra translation calls

    # Different language for same text: must NOT reuse Hindi cache
    kannada_text = "ಭಾರತದ ಮೊದಲ ಆಳ ಬಾಹ್ಯಾಕಾಶ ಕಾರ್ಯಾಚರಣೆ ಯಶಸ್ವಿಯಾಗಿ ಪ್ರಾರಂಭವಾಯಿತು."
    def mock_gtx_kn(text, code, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        return kannada_text

    monkeypatch.setattr("app.services.ai_service._translate_google_gtx", mock_gtx_kn)
    t3 = translate_text(sample, "Kannada")
    assert t3 == kannada_text
    assert call_count == 2


def test_groq_translation_fallback_to_gtx_on_failure(monkeypatch):
    """Verify that if Groq hits rate limits or fails, it cleanly falls back to Google GTX."""
    from app.services.ai_service import translate_text, _TRANSLATION_MEM_CACHE
    _TRANSLATION_MEM_CACHE.clear()

    monkeypatch.setenv("GROQ_API_KEY", "dummy-key")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")

    def mock_groq_fail(text, target_language, max_retries=2):
        raise RuntimeError("Groq 429: Rate limit reached for organization")

    gtx_called = False
    def mock_gtx(text, target_code, target_language="", max_retries=2, timeout=12):
        nonlocal gtx_called
        gtx_called = True
        return "आउटलुक मेल और अन्य सेवाएं प्रभावित हुईं।"

    monkeypatch.setattr("app.services.ai_service._translate_with_groq", mock_groq_fail)
    monkeypatch.setattr("app.services.ai_service._translate_google_gtx", mock_gtx)

    unique_text = f"Outlook mail and other services were affected {uuid.uuid4()}."
    result = translate_text(unique_text, "Hindi")
    assert gtx_called is True
    assert "आउटलुक" in result



def test_audio_manager_rejects_non_indic_text_for_indic_language(client, sample_edition_and_articles, monkeypatch):
    """Verify audio_manager raises error and does NOT generate audio if translation produces non-Indic text."""
    art = sample_edition_and_articles["article1"]

    # Mock translation to erroneously return English text
    monkeypatch.setattr("app.services.audio_manager.translate_text", lambda text, lang: "This is fake English translation.")

    payload = {
        "article_id": art.id,
        "mode": "summary",
        "language": "Telugu",
    }
    res = client.post("/api/audio/generate", json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data["status"] == "error"
    assert "Translation validation failed for Telugu" in data["message"]


def test_corrupted_cache_auto_purge_and_regeneration(client, sample_edition_and_articles, monkeypatch):
    """Verify that if AudioCache contains corrupted English text for an Indic language, it is purged and regenerated."""
    art = sample_edition_and_articles["article1"]
    content_hash = compute_content_hash(art.id, art.headline, art.content)

    # Seed a corrupted cache entry with English text for Kannada matching the article content_hash
    with client.application.app_context():
        corrupt_cache = AudioCache(
            id=str(uuid.uuid4()),
            content_hash=content_hash,
            article_id=art.id,
            mode="summary",
            language="Kannada",
            voice="kn-IN-GaganNeural",
            text_content="This is English text that was erroneously cached as Kannada.",
            audio_path="uploads/audio/corrupt_kannada.mp3",
            duration_seconds=15.0,
            file_size_bytes=1000,
        )
        db.session.add(corrupt_cache)
        db.session.commit()
        corrupt_id = corrupt_cache.id

    # Mock translation to return real Kannada text
    real_kannada = "ಭಾರತ ಇಂದು ಶ್ರೀಹರಿಕೋಟಾದಿಂದ ತನ್ನ ಪ್ರಮುಖ ಆಳ ಬಾಹ್ಯಾಕಾಶ ಪರಿಶೋಧನಾ ಕಾರ್ಯಾಚರಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿತು."
    monkeypatch.setattr("app.services.audio_manager.translate_text", lambda text, lang: real_kannada)

    def mock_synthesize(text, language="Kannada", output_path=None):
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(b"valid-kannada-audio")
        return {
            "voice": "kn-IN-GaganNeural",
            "file_size_bytes": 19,
            "duration_seconds": 25.0,
            "provider": "edge-tts",
        }

    monkeypatch.setattr("app.services.audio_manager.synthesize_speech", mock_synthesize)

    # Request Kannada summary
    res = client.post(
        "/api/audio/generate",
        json={"article_id": art.id, "mode": "summary", "language": "Kannada"},
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["cached"] is False
    assert data["language"] == "Kannada"
    assert "ಭಾರತ ಇಂದು" in data["text"]

    # Verify corrupt cache entry was deleted from database
    with client.application.app_context():
        old_record = db.session.get(AudioCache, corrupt_id)
        assert old_record is None, "Corrupted cache record was not purged from DB!"


def test_multi_article_language_switch_sequence(client, sample_edition_and_articles, monkeypatch):
    """Verify switching languages across different articles produces distinct, authentic translations:
    Article 1 (Hindi) -> Article 2 (Kannada) -> Article 1 (Telugu)
    """
    art1 = sample_edition_and_articles["article1"]
    art2 = sample_edition_and_articles["article2"]

    lang_dict = {
        "Hindi": "भारत ने अंतरिक्ष मिशन शुरू किया।",
        "Kannada": "ಷೇರು ಸೂಚ್ಯಂಕಗಳು ದಾಖಲೆಯ ಗರಿಷ್ಠ ಮಟ್ಟವನ್ನು ತಲುಪಿವೆ.",
        "Telugu": "భారత అంతరిక్ష పరిశోధన మిషన్ ప్రారంభమైంది.",
    }

    monkeypatch.setattr("app.services.audio_manager.translate_text", lambda text, lang: lang_dict[lang])

    def mock_synthesize(text, language="English", output_path=None):
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(b"dummy-audio-content")
        return {
            "voice": get_voice_for_language(language),
            "file_size_bytes": 100,
            "duration_seconds": 20.0,
            "provider": "edge-tts",
        }

    monkeypatch.setattr("app.services.audio_manager.synthesize_speech", mock_synthesize)

    # Step 1: Article 1 in Hindi
    res1 = client.post(
        "/api/audio/generate",
        json={"article_id": art1.id, "mode": "summary", "language": "Hindi"},
    )
    assert res1.status_code == 200
    d1 = res1.get_json()["data"]
    assert d1["language"] == "Hindi"
    assert "भारत ने" in d1["text"]

    # Step 2: Article 2 in Kannada
    res2 = client.post(
        "/api/audio/generate",
        json={"article_id": art2.id, "mode": "summary", "language": "Kannada"},
    )
    assert res2.status_code == 200
    d2 = res2.get_json()["data"]
    assert d2["language"] == "Kannada"
    assert "ಷೇರು ಸೂಚ್ಯಂಕಗಳು" in d2["text"]

    # Step 3: Back to Article 1 in Telugu
    res3 = client.post(
        "/api/audio/generate",
        json={"article_id": art1.id, "mode": "summary", "language": "Telugu"},
    )
    assert res3.status_code == 200
    d3 = res3.get_json()["data"]
    assert d3["language"] == "Telugu"
    assert "భారత అంతరిక్ష" in d3["text"]

