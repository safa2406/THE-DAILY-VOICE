import os
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "English": {
        "code": "en",
        "locale": "en-IN",
        "voice": "en-IN-NeerjaNeural",
        "label": "English (India)",
        "gcp_voice": "en-IN-Wavenet-D",
    },
    "Hindi": {
        "code": "hi",
        "locale": "hi-IN",
        "voice": "hi-IN-SwaraNeural",
        "label": "हिन्दी (Hindi)",
        "gcp_voice": "hi-IN-Wavenet-D",
    },
    "Kannada": {
        "code": "kn",
        "locale": "kn-IN",
        "voice": "kn-IN-GaganNeural",
        "label": "ಕನ್ನಡ (Kannada)",
        "gcp_voice": "kn-IN-Wavenet-A",
    },
    "Telugu": {
        "code": "te",
        "locale": "te-IN",
        "voice": "te-IN-ShrutiNeural",
        "label": "తెలుగు (Telugu)",
        "gcp_voice": "te-IN-Wavenet-A",
    },
    "Marathi": {
        "code": "mr",
        "locale": "mr-IN",
        "voice": "mr-IN-AarohiNeural",
        "label": "मराठी (Marathi)",
        "gcp_voice": "mr-IN-Wavenet-A",
    },
}


def get_voice_for_language(language: str) -> str:
    """Return the TTS voice identifier for the specified language."""
    if language in SUPPORTED_LANGUAGES:
        return SUPPORTED_LANGUAGES[language]["voice"]
    raise ValueError(f"Unsupported language '{language}'. Supported: {list(SUPPORTED_LANGUAGES.keys())}")


class TTSProvider(ABC):
    """Abstract base class for Text-to-Speech providers."""

    @abstractmethod
    async def synthesize(self, text: str, language: str, output_path: str) -> dict[str, Any]:
        """Synthesize speech audio from text and write to output_path."""
        pass


class EdgeTTSProvider(TTSProvider):
    """Development and default Text-to-Speech provider using Microsoft Edge Neural Voices."""

    async def synthesize(self, text: str, language: str, output_path: str) -> dict[str, Any]:
        import edge_tts

        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language '{language}'. Supported languages: {', '.join(SUPPORTED_LANGUAGES.keys())}"
            )

        voice = SUPPORTED_LANGUAGES[language]["voice"]
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Generate audio using edge-tts
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)

        file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        if file_size == 0:
            raise RuntimeError(f"Edge-TTS failed to generate audio for language '{language}'.")

        # Edge-TTS encodes MP3 at ~48 kbps mono (~6000 bytes/sec)
        word_count = len(text.split())
        est_by_words = max(1, round(word_count / 2.3))
        est_by_size = max(1, round(file_size / 6000))
        duration_seconds = max(est_by_size, est_by_words)

        return {
            "voice": voice,
            "duration_seconds": duration_seconds,
            "file_size_bytes": file_size,
            "provider": "edge-tts",
        }


class GoogleCloudTTSProvider(TTSProvider):
    """Production Text-to-Speech provider for Google Cloud Platform."""

    def __init__(self):
        self._available = False
        try:
            from google.cloud import texttospeech
            if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                self.client = texttospeech.TextToSpeechClient()
                self._available = True
        except Exception:
            self._available = False

    async def synthesize(self, text: str, language: str, output_path: str) -> dict[str, Any]:
        if not self._available:
            logger.info("Google Cloud TTS credentials not found. Falling back to Edge-TTS provider.")
            fallback = EdgeTTSProvider()
            return await fallback.synthesize(text, language, output_path)

        from google.cloud import texttospeech

        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Language '{language}' not supported by Google Cloud TTS configuration.")

        lang_cfg = SUPPORTED_LANGUAGES[language]
        s_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=lang_cfg["locale"],
            name=lang_cfg["gcp_voice"],
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
        )

        response = self.client.synthesize_speech(
            input=s_input, voice=voice, audio_config=audio_config
        )

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as out:
            out.write(response.audio_content)

        file_size = len(response.audio_content)
        duration_seconds = max(1, round(len(text.split()) / 2.3))

        return {
            "voice": lang_cfg["gcp_voice"],
            "duration_seconds": duration_seconds,
            "file_size_bytes": file_size,
            "provider": "google-cloud-tts",
        }


def get_tts_provider() -> TTSProvider:
    """Returns configured TTS provider based on environment variables."""
    provider_name = os.getenv("TTS_PROVIDER", "edge-tts").lower()
    if provider_name in ["gcp", "google", "google-cloud-tts"]:
        gcp_provider = GoogleCloudTTSProvider()
        if gcp_provider._available:
            return gcp_provider
        logger.info("GCP TTS requested but credentials not configured. Using EdgeTTSProvider.")
    return EdgeTTSProvider()


def synthesize_speech(text: str, language: str, output_path: str) -> dict[str, Any]:
    """
    Synchronous helper to synthesize speech using the active provider.
    Runs asyncio event loop cleanly whether inside synchronous Flask workers or async runners.
    """
    provider = get_tts_provider()

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Running inside an existing event loop
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(provider.synthesize(text, language, output_path))
    else:
        return asyncio.run(provider.synthesize(text, language, output_path))
