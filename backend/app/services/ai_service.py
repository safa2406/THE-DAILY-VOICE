import os
import re
import hashlib
import logging
from typing import Any
from functools import lru_cache

import json
import threading

logger = logging.getLogger(__name__)

# ISO and script mapping for supported Indic languages
SUPPORTED_INDIC_LANGS = {
    "Hindi": {
        "gtx_code": "hi",
        "unicode_pattern": r'[\u0900-\u097F]',
        "label": "हिन्दी",
    },
    "Marathi": {
        "gtx_code": "mr",
        "unicode_pattern": r'[\u0900-\u097F]',
        "label": "मराठी",
    },
    "Kannada": {
        "gtx_code": "kn",
        "unicode_pattern": r'[\u0C80-\u0CFF]',
        "label": "ಕನ್ನಡ",
    },
    "Telugu": {
        "gtx_code": "te",
        "unicode_pattern": r'[\u0C00-\u0C7F]',
        "label": "తెలుగు",
    },
}

# Legacy code mapping compatibility
TRANSLATION_LANG_CODES = {
    "English": "en-GB",
    "Hindi": "hi-IN",
    "Kannada": "kn-IN",
    "Telugu": "te-IN",
    "Marathi": "mr-IN",
}

# In-memory translation and summary cache
_TRANSLATION_MEM_CACHE: dict[str, str] = {}
_SUMMARY_MEM_CACHE: dict[str, str] = {}
_CACHE_FILE_LOCK = threading.Lock()


def get_cache_storage_dir() -> str:
    """Returns absolute path to local cache directory for summaries and translations."""
    try:
        from flask import current_app
        base_dir = os.path.abspath(os.path.join(current_app.root_path, "..", "uploads", "cache"))
    except (RuntimeError, ImportError):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "cache"))
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


def _load_persistent_json_cache(filename: str) -> dict[str, str]:
    """Loads a JSON cache file from disk into a dictionary."""
    cache_dir = get_cache_storage_dir()
    cache_path = os.path.join(cache_dir, filename)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            logger.warning(f"Failed to load cache {filename}: {e}")
    return {}


def _save_persistent_json_cache(filename: str, data: dict[str, str]) -> None:
    """Atomically persists cache dictionary to disk."""
    cache_dir = get_cache_storage_dir()
    cache_path = os.path.join(cache_dir, filename)
    tmp_path = os.path.join(cache_dir, f"{filename}.tmp")
    with _CACHE_FILE_LOCK:
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, cache_path)
        except Exception as e:
            logger.warning(f"Failed to save cache {filename}: {e}")
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass


def get_cached_translation(cache_key: str, target_language: str) -> str | None:
    """Retrieves a cached translation if available and valid in the target Indic script."""
    global _TRANSLATION_MEM_CACHE
    if not _TRANSLATION_MEM_CACHE:
        _TRANSLATION_MEM_CACHE.update(_load_persistent_json_cache("translations.json"))
    val = _TRANSLATION_MEM_CACHE.get(cache_key)
    if val:
        valid, _ = validate_indic_text(val, target_language)
        if valid:
            return val
        else:
            _TRANSLATION_MEM_CACHE.pop(cache_key, None)
            _save_persistent_json_cache("translations.json", _TRANSLATION_MEM_CACHE)
    return None


def set_cached_translation(cache_key: str, text: str) -> None:
    """Saves a valid translation to both in-memory and persistent disk cache."""
    global _TRANSLATION_MEM_CACHE
    _TRANSLATION_MEM_CACHE[cache_key] = text
    _save_persistent_json_cache("translations.json", _TRANSLATION_MEM_CACHE)


def get_cached_summary(cache_key: str) -> str | None:
    """Retrieves a cached summary from memory or disk."""
    global _SUMMARY_MEM_CACHE
    if not _SUMMARY_MEM_CACHE:
        _SUMMARY_MEM_CACHE.update(_load_persistent_json_cache("summaries.json"))
    return _SUMMARY_MEM_CACHE.get(cache_key)


def set_cached_summary(cache_key: str, text: str) -> None:
    """Saves a summary to both in-memory and persistent disk cache."""
    global _SUMMARY_MEM_CACHE
    _SUMMARY_MEM_CACHE[cache_key] = text
    _save_persistent_json_cache("summaries.json", _SUMMARY_MEM_CACHE)



def clean_text_for_narration(text: str) -> str:
    """Cleans text of artifacts, HTML tags, and markdown before narration."""
    if not text:
        return ""
    # Strip HTML tags if any
    clean = re.sub(r'<[^>]+>', '', text)
    # Strip markdown bold/italics
    clean = re.sub(r'[*_~`#]', '', clean)
    # Normalize whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def validate_indic_text(text: str, target_language: str, min_ratio: float = 0.35) -> tuple[bool, float]:
    """
    Validates that the provided text is genuinely in the target Indic language script.
    Prevents silent fallback to English or half-translated text.
    Returns (is_valid, indic_ratio).
    """
    if target_language.lower() in ["english", "en"]:
        return True, 1.0

    if not text or not str(text).strip():
        return False, 0.0

    lang_info = SUPPORTED_INDIC_LANGS.get(target_language)
    if not lang_info:
        return False, 0.0

    indic_chars = len(re.findall(lang_info["unicode_pattern"], text))
    latin_chars = len(re.findall(r'[a-zA-Z]', text))
    total_alpha = indic_chars + latin_chars

    if total_alpha == 0:
        return False, 0.0

    ratio = indic_chars / total_alpha
    # Valid if at least min_ratio of characters are in the native Indic script
    # and has at least 8 native characters (prevents false positives)
    is_valid = bool(ratio >= min_ratio and indic_chars >= 8)
    return is_valid, ratio


def generate_extractive_summary(headline: str, content: str, min_words: int = 70, max_words: int = 95) -> str:
    """
    Algorithmic extractive factual summarizer specifically tuned for radio / audio news:
    - Targets 30–45s listening duration (~70–95 words).
    - Preserves named entities, locations, numbers, dates, and core factual statements.
    - Zero hallucinations: strictly excerpts sentences from original reporting.
    - Eliminates meta-intros and conclusions.
    """
    clean_body = clean_text_for_narration(content)
    raw_sentences = re.split(r'(?<=[.!?])\s+', clean_body)
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 20]

    if not sentences:
        return headline

    headline_words = set(re.findall(r'[a-zA-Z0-9]+', headline.lower()))

    scored = []
    for idx, s in enumerate(sentences):
        words = re.findall(r'[a-zA-Z0-9]+', s.lower())
        overlap = len(set(words).intersection(headline_words))
        position_weight = 4.0 if idx == 0 else (2.0 if idx == 1 else 1.0)
        fact_bonus = 2.0 if re.search(r'\b\d+(\.\d+)?(%|bn|mn|cr|crore|billion|million|st|nd|rd|th)?\b', s) else 0.0
        cap_bonus = sum(1 for w in s.split() if w and w[0].isupper() and w.lower() not in headline_words) * 0.2

        score = (overlap * 2.0 + position_weight + fact_bonus + cap_bonus)
        scored.append((score, idx, s))

    selected_indices = {0}
    current_words = len(sentences[0].split())

    remaining = sorted(scored[1:], key=lambda x: x[0], reverse=True)
    for score, idx, s in remaining:
        swords = len(s.split())
        if current_words + swords <= max_words:
            selected_indices.add(idx)
            current_words += swords
        elif current_words < min_words:
            selected_indices.add(idx)
            current_words += swords
            break

    ordered_sentences = [sentences[i] for i in sorted(selected_indices)]
    summary = " ".join(ordered_sentences)
    return clean_text_for_narration(summary)


def generate_article_summary(headline: str, content: str) -> str:
    """
    Generates a concise AI summary of the selected article.
    - Preserves important facts, names, locations, dates, numbers.
    - Target listening duration: 30–45 seconds (~70–95 words).
    - Uses independent persistent disk cache for speed and restart persistence.
    - Uses Groq AI if GROQ_API_KEY is available; falls back to factual extractive summarizer.
    """
    cache_key = hashlib.sha256(f"{headline}:{content[:500]}".encode("utf-8")).hexdigest()
    cached = get_cached_summary(cache_key)
    if cached:
        return cached

    groq_api_key = os.getenv("GROQ_API_KEY")
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    if groq_api_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_api_key)
            prompt = (
                "You are an expert news audio editor. Summarize the following news article for audio narration.\n"
                "CRITICAL REQUIREMENTS:\n"
                "- Target length: 70 to 95 words (exactly 30 to 45 seconds when read aloud).\n"
                "- Preserve all important facts, names, locations, dates, and numbers accurately.\n"
                "- Do not introduce information that is not present in the original article.\n"
                "- Start immediately with the core news event. Do NOT include phrases like 'This article discusses', 'According to the report', or 'In conclusion'.\n"
                "- Output ONLY the clean summary text, nothing else.\n\n"
                f"Headline: {headline}\n\n"
                f"Article Content:\n{content[:4000]}"
            )
            completion = client.chat.completions.create(
                model=groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=250,
                timeout=15.0,
            )
            ai_summary = completion.choices[0].message.content.strip()
            if ai_summary and len(ai_summary.split()) >= 40:
                cleaned = clean_text_for_narration(ai_summary)
                set_cached_summary(cache_key, cleaned)
                return cleaned
        except Exception as e:
            logger.warning(f"Groq summarization failed or not configured, using extractive fallback: {e}")

    # Robust factual extractive summarizer fallback
    extractive = generate_extractive_summary(headline, content)
    set_cached_summary(cache_key, extractive)
    return extractive


def chunk_text_by_length(text: str, max_chars: int = 2000) -> list[str]:
    """Splits text into paragraph or sentence-aware chunks below max_chars."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_len = 0

    for p in paragraphs:
        p_clean = p.strip()
        if not p_clean:
            continue
        if len(p_clean) <= max_chars:
            if current_len + len(p_clean) + 2 <= max_chars:
                current_chunk.append(p_clean)
                current_len += len(p_clean) + 2
            else:
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                current_chunk = [p_clean]
                current_len = len(p_clean)
        else:
            sentences = re.split(r'(?<=[.!?])\s+', p_clean)
            for s in sentences:
                if not s:
                    continue
                if current_len + len(s) + 1 <= max_chars:
                    current_chunk.append(s)
                    current_len += len(s) + 1
                else:
                    if current_chunk:
                        chunks.append(" ".join(current_chunk))
                    current_chunk = [s]
                    current_len = len(s)

    if current_chunk:
        chunks.append("\n\n".join(current_chunk) if len(current_chunk) > 1 and "\n" in text else " ".join(current_chunk))

    return [c.strip() for c in chunks if c.strip()]


def _translate_google_gtx(
    text: str,
    target_code: str,
    target_language: str = "",
    max_retries: int = 2,
    timeout: int = 12,
) -> str:
    """
    Translates text via Google Client API endpoint without quota limits.
    - Fast (~0.8s), robust, and supports all Indic languages.
    - Handles long texts by chunking into paragraph-aware blocks.
    - Retries temporary failures (timeouts, network glitches) with backoff.
    - Strictly validates that output contains authentic native script.
    """
    import urllib.request
    import urllib.parse
    import json
    import time

    if not target_language:
        target_language = next((k for k, v in SUPPORTED_INDIC_LANGS.items() if v.get("gtx_code") == target_code), "")

    chunks = chunk_text_by_length(text, max_chars=1800)
    translated_parts = []

    for idx, chunk in enumerate(chunks):
        url = (
            f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={target_code}&dt=t&q="
            + urllib.parse.quote(chunk)
        )
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
        )
        part_text = None
        last_err = None
        for attempt in range(max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    chunk_translated = "".join([part[0] for part in data[0] if part[0]])
                    if chunk_translated and chunk_translated.strip():
                        part_text = chunk_translated.strip()
                        break
                    else:
                        last_err = f"Empty translation response for chunk {idx + 1}"
            except Exception as e:
                last_err = str(e)
                if attempt < max_retries:
                    time.sleep(0.8 * (attempt + 1))

        if not part_text:
            raise RuntimeError(f"Google GTX translation failed on chunk {idx + 1}/{len(chunks)}: {last_err}")
        translated_parts.append(part_text)

    combined = "\n\n".join(translated_parts)
    if target_language:
        valid, ratio = validate_indic_text(combined, target_language)
        if not valid:
            raise RuntimeError(
                f"Google GTX output failed Indic validation for {target_language} (script ratio={ratio:.2f})"
            )
    return combined


def _translate_with_groq(text: str, target_language: str, max_retries: int = 2) -> str:
    """
    Translates text via Groq Cloud LLM using configured free-tier model.
    - Primary translation tier when GROQ_API_KEY is configured.
    - Model is configurable via GROQ_MODEL environment variable (default: openai/gpt-oss-120b).
    - Supports long texts by splitting into chunked prompts.
    - Retries on temporary rate limits or timeouts with backoff.
    - Validates output contains authentic native Indic script.
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    from groq import Groq
    import time

    client = Groq(api_key=groq_api_key)
    chunks = chunk_text_by_length(text, max_chars=2500)
    translated_parts = []

    for idx, chunk in enumerate(chunks):
        prompt = (
            f"You are an expert bilingual news editor. Translate the following news broadcast text from English into natural, fluent, grammatically correct {target_language} suitable for radio listening.\n"
            "CRITICAL REQUIREMENTS:\n"
            f"- Translate the entire text into native {target_language} script.\n"
            "- Preserve all names, locations, numbers, dates, and facts accurately.\n"
            f"- Output ONLY the {target_language} translation, with no explanation or preface.\n\n"
            f"English text:\n{chunk}"
        )
        part_text = None
        last_err = None
        for attempt in range(max_retries + 1):
            try:
                completion = client.chat.completions.create(
                    model=groq_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=2500,
                    timeout=25.0,
                )
                candidate = completion.choices[0].message.content.strip()
                valid, ratio = validate_indic_text(candidate, target_language)
                if valid:
                    part_text = candidate
                    break
                else:
                    last_err = f"Script validation failed on chunk {idx + 1} (ratio={ratio:.2f})"
            except Exception as e:
                last_err = str(e)
                if attempt < max_retries:
                    time.sleep(1.0 * (attempt + 1))

        if not part_text:
            raise RuntimeError(f"Groq failed on chunk {idx + 1}/{len(chunks)}: {last_err}")
        translated_parts.append(part_text)

    combined = "\n\n".join(translated_parts)
    valid, ratio = validate_indic_text(combined, target_language)
    if not valid:
        raise RuntimeError(f"Groq output failed Indic validation for {target_language} (script ratio={ratio:.2f})")
    return combined


def translate_text(text: str, target_language: str) -> str:
    """
    Translates text into the specified language (English, Hindi, Kannada, Telugu, Marathi).
    - If target_language is English, returns text unchanged.
    - Checks independent persistent translation cache first.
    - Uses Groq as primary provider if GROQ_API_KEY is configured.
    - Uses Google GTX as fast, high-capacity fallback.
    - MyMemory has been permanently removed from the fallback chain.
    - Strictly validates that translation contains authentic Indic script.
    - NEVER returns English text when a non-English language is requested.
    - Never overwrites the original English text in the database.
    """
    if not text or target_language.lower() in ["english", "en"]:
        return text

    if target_language not in SUPPORTED_INDIC_LANGS:
        raise ValueError(
            f"Unsupported language '{target_language}'. Supported languages: English, {', '.join(SUPPORTED_INDIC_LANGS.keys())}"
        )

    clean_input = clean_text_for_narration(text)
    content_hash = hashlib.sha256(clean_input.encode("utf-8")).hexdigest()
    cache_key = f"{target_language}:{content_hash}"

    # 1. Check Independent Persistent Translation Cache
    cached_val = get_cached_translation(cache_key, target_language)
    if cached_val:
        return cached_val

    lang_info = SUPPORTED_INDIC_LANGS[target_language]
    gtx_code = lang_info["gtx_code"]
    errors = []

    # 2. Tier 1: Groq LLM Translation (Primary, if configured)
    if os.getenv("GROQ_API_KEY"):
        try:
            candidate = _translate_with_groq(clean_input, target_language)
            if candidate:
                set_cached_translation(cache_key, candidate)
                return candidate
        except Exception as e:
            logger.warning(f"Groq translation failed for {target_language}: {e}")
            errors.append(f"Groq: {e}")

    # 3. Tier 2: Direct Google Translate Engine (Fallback)
    try:
        candidate = _translate_google_gtx(clean_input, gtx_code, target_language=target_language)
        if candidate:
            set_cached_translation(cache_key, candidate)
            return candidate
    except Exception as e:
        logger.warning(f"Google GTX translation failed for {target_language}: {e}")
        errors.append(f"Google GTX: {e}")

    # STRICT REQUIREMENT: NEVER SILENTLY FALL BACK TO ENGLISH
    err_summary = "; ".join(errors) if errors else "No translation provider was able to complete the request"
    logger.error(f"All translation tiers failed for {target_language}: {err_summary}")
    raise ValueError(
        f"Unable to translate article into {target_language}. All translation providers failed or returned incomplete text: {err_summary}"
    )



def generate_headlines_script(newspaper_name: str, headlines: list[Any], language: str = "English") -> str:
    """
    Creates a dedicated headlines bulletin reading only the headlines of the edition.
    Excludes article bodies and summaries.
    """
    if not headlines:
        return f"There are no headlines available for {newspaper_name}."

    clean_headlines = []
    for h in headlines:
        if hasattr(h, "headline") and getattr(h, "headline"):
            clean_headlines.append(str(getattr(h, "headline")))
        elif isinstance(h, str):
            clean_headlines.append(h)
        else:
            clean_headlines.append(str(h))

    ordinal_words = [
        "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh",
        "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth",
        "Fourteenth", "Fifteenth"
    ]

    parts = [f"Welcome to The Daily Voice. Here are today's top broadsheet headlines from {newspaper_name}."]
    for idx, h in enumerate(clean_headlines[:12]):
        prefix = ordinal_words[idx] if idx < len(ordinal_words) else f"Headline {idx + 1}"
        parts.append(f"{prefix}: {clean_text_for_narration(h)}.")

    parts.append(f"That concludes today's headline briefing from {newspaper_name}.")
    script = " ".join(parts)

    if language != "English":
        script = translate_text(script, language)

    return script
