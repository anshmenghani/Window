import io
import json
import os
import re
import time
from typing import Any

import httpx
from openai import OpenAI

from prompts import (
    DAILY_PROMPT_SCHEMA, MEMORY_SCHEMA, WINDOW_SCHEMA, daily_prompt_system, memory_system, window_system_prompt,
)


def client() -> OpenAI:
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# ---------- providers: Meta's Muse models first, OpenAI as the backup ----------
# AI_PROVIDER=meta plus META_API_KEY turns Meta on. Any Meta error, timeout or bad JSON falls back to
# OpenAI for that one call, so a letter always gets through. Safety checks and interest embeddings
# stay on OpenAI (Meta doesn't offer them).
META_BASE_URL = "https://api.meta.ai/v1"
META_CHAT_MODEL = "muse-spark-1.3"
META_VOICE_MODEL = "muse-voice-transcribe-1.0"


def meta_key() -> str | None:
    if os.getenv("AI_PROVIDER", "openai").strip().lower() != "meta":
        return None
    return os.getenv("META_API_KEY") or os.getenv("MODEL_API_KEY") or None


def provider() -> str:
    return "meta" if meta_key() else "openai"


def meta_client() -> OpenAI:
    return OpenAI(base_url=META_BASE_URL, api_key=meta_key(), timeout=30, max_retries=1)


def _log(job: str, used: str, started: float, note: str = "") -> None:
    print(f"[ai] {job}: {used} in {time.time() - started:.1f}s{(' (' + note + ')') if note else ''}", flush=True)


def chat(job: str, messages: list[dict[str, Any]], *, model: str, max_tokens: int, schema: dict[str, Any] | None = None,
         json_object: bool = False, effort: str = "low") -> str:
    """One chat call: Muse Spark when it's on, otherwise (or if it fails) the OpenAI model given."""
    started = time.time()
    if meta_key():
        try:
            meta_messages = [_meta_message(m) for m in messages]
            extra: dict[str, Any] = {}
            if schema is not None:
                extra["response_format"] = {"type": "json_schema", "json_schema": {"name": job, "schema": schema}}
            elif json_object:
                extra["response_format"] = {"type": "json_object"}
            # Muse Spark reasons before answering and that thinking counts toward the token limit,
            # so it gets extra room on top of the answer's own budget.
            response = meta_client().chat.completions.create(
                model=META_CHAT_MODEL, messages=meta_messages, reasoning_effort=effort,
                max_completion_tokens=max_tokens + 4000, **extra,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise ValueError("empty reply")
            if schema is not None or json_object:
                json.loads(text)
            _log(job, "meta", started)
            return text
        except Exception as error:
            _log(job, "meta failed, using openai", started, f"{type(error).__name__}: {str(error)[:200]}")
            started = time.time()
    extra = {}
    if schema is not None:
        extra["response_format"] = {"type": "json_schema", "json_schema": {"name": job, "strict": True, "schema": schema}}
    elif json_object:
        extra["response_format"] = {"type": "json_object"}
    response = client().chat.completions.create(model=model, messages=messages, max_tokens=max_tokens, **extra)
    _log(job, "openai", started)
    return (response.choices[0].message.content or "").strip()


def _meta_message(message: dict[str, Any]) -> dict[str, Any]:
    """Meta takes the same messages, minus OpenAI's image `detail` option."""
    content = message.get("content")
    if not isinstance(content, list):
        return message
    parts = []
    for part in content:
        if part.get("type") == "image_url":
            part = {"type": "image_url", "image_url": {"url": part["image_url"]["url"]}}
        parts.append(part)
    return {**message, "content": parts}


def embed_interests(interests: list[str]) -> list[float]:
    text = ", ".join(interests).strip() or "general interests"
    return client().embeddings.create(model="text-embedding-3-small", input=text).data[0].embedding


def cosine(a: list[float], b: list[float]) -> float:
    import numpy as np
    av, bv = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    denom = float(np.linalg.norm(av) * np.linalg.norm(bv))
    return float(np.dot(av, bv) / denom) if denom else 0.0


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def fit_reason(me: dict[str, Any], them: dict[str, Any], shared: list[str], mutual: bool) -> str:
    request = f"Write one warm sentence of at most 25 words telling {me.get('name') or 'them'} why they and {them.get('name') or 'their match'} fit. Mention 2–3 genuinely shared interests from {shared}." + (f" Mention that {them.get('name') or 'they'} dreams of visiting {me.get('home_city')}." if mutual else "") + " Refer to the match by first name. No emojis."
    text = chat("fit_reason", [{"role": "user", "content": request}], model="gpt-4o-mini", max_tokens=80, effort="minimal")
    return text or "You share a curiosity for discovering new places."


def moderate(caption: str, photo_url: str) -> bool:
    response = client().moderations.create(
        model="omni-moderation-latest",
        input=[{"type": "text", "text": caption}, {"type": "image_url", "image_url": {"url": photo_url}}],
    )
    return bool(response.results[0].flagged)


LANGUAGE_NAMES = {
    "en": "English", "ja": "Japanese", "ko": "Korean", "zh": "Chinese", "es": "Spanish", "fr": "French",
    "de": "German", "it": "Italian", "pt": "Portuguese", "hi": "Hindi", "ar": "Arabic", "ru": "Russian",
    "nl": "Dutch", "tr": "Turkish", "vi": "Vietnamese", "th": "Thai", "id": "Indonesian", "pl": "Polish",
}


def transcribe(audio: bytes, languages: list[str] | None = None, keywords: list[str] | None = None) -> str:
    """Voice note to text: Muse Voice Transcribe when it's on, otherwise (or if it fails) Whisper."""
    started = time.time()
    if meta_key():
        try:
            text = _meta_transcribe(audio, languages or [], keywords or [])
            _log("transcribe", "meta", started)
            return text
        except Exception as error:
            _log("transcribe", "meta failed, using openai", started, f"{type(error).__name__}: {str(error)[:200]}")
            started = time.time()
    result = client().audio.transcriptions.create(model="whisper-1", file=("voice.m4a", audio, "audio/mp4"))
    _log("transcribe", "openai", started)
    return result.text


def to_wav(audio: bytes, rate: int = 24000) -> bytes:
    """The phone records m4a; Muse Voice Transcribe takes mono 16-bit WAV (24 kHz is its native rate)."""
    import wave

    import av
    pcm = bytearray()
    with av.open(io.BytesIO(audio)) as container:
        resampler = av.AudioResampler(format="s16", layout="mono", rate=rate)
        for frame in container.decode(audio=0):
            for out in resampler.resample(frame):
                pcm += out.to_ndarray().tobytes()
        for out in resampler.resample(None):
            pcm += out.to_ndarray().tobytes()
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(bytes(pcm))
    return buffer.getvalue()


def _meta_transcribe(audio: bytes, languages: list[str], keywords: list[str]) -> str:
    request: dict[str, Any] = {"mode": "PUSH_TO_TALK", "model": META_VOICE_MODEL, "audioEncoding": "WAV"}
    bias = [LANGUAGE_NAMES[code.split("-")[0]] for code in languages if code.split("-")[0] in LANGUAGE_NAMES]
    if bias:
        request["languageBias"] = list(dict.fromkeys(bias))
    words = [word for word in keywords if word]
    if words:
        request["keywords"] = list(dict.fromkeys(words))[:20]
    response = httpx.post(
        f"{META_BASE_URL}/asr/transcribe",
        headers={"Authorization": f"Bearer {meta_key()}"},
        files={"request": (None, json.dumps(request), "application/json"), "audio": ("voice.wav", to_wav(audio), "audio/wav")},
        timeout=60,
    )
    if response.status_code != 200:
        raise RuntimeError(f"HTTP {response.status_code}: {response.text[:200]}")
    return (response.json().get("transcript") or "").strip()


def hide_contact(text: str) -> str:
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "•••", text)
    text = re.sub(r"(?:https?://|www\.)\S+", "•••", text, flags=re.I)
    text = re.sub(r"(?<!\w)@[A-Za-z0-9_.]{2,}", "•••", text)
    text = re.sub(r"(?<!\w)(?:\+?\d[\d ().-]{6,}\d)(?!\w)", "•••", text)
    return text


def translate_window(photo_url: str, caption: str, transcript: str | None, src: str, lang: str, city: str, country: str) -> dict[str, Any]:
    prompt = window_system_prompt(src, lang, city, country)
    transcript_text = transcript if transcript is not None else "[absent: no voice note was sent]"
    content = [
        {"type": "text", "text": f"Caption: {caption}\nTranscript: {transcript_text}"},
        {"type": "image_url", "image_url": {"url": photo_url, "detail": "high"}},
    ]
    text = chat(
        "window_translation", [{"role": "system", "content": prompt}, {"role": "user", "content": content}],
        model="gpt-4o", max_tokens=800, schema=WINDOW_SCHEMA,
    )
    parsed = json.loads(text or "{}")
    for sticker in parsed.get("stickers", []):
        sticker["x"] = min(0.9, max(0.1, float(sticker.get("x", 0.5))))
        sticker["y"] = min(0.9, max(0.1, float(sticker.get("y", 0.5))))
    return parsed


async def geocode(spot: str, city: str) -> tuple[float, float] | None:
    async with httpx.AsyncClient(timeout=8) as http:
        response = await http.get("https://nominatim.openstreetmap.org/search", params={"q": f"{spot}, {city}", "format": "json", "limit": 1}, headers={"User-Agent": "WindowHackGT/1.0"})
        response.raise_for_status()
        data = response.json()
        return (float(data[0]["lat"]), float(data[0]["lon"])) if data else None


def dub_transcript(window_id: str, transcript: str) -> bytes | None:
    key, voice = os.getenv("ELEVENLABS_API_KEY"), os.getenv("ELEVENLABS_VOICE_ID")
    if not key or not voice or not transcript:
        return None
    response = httpx.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}", headers={"xi-api-key": key}, json={"text": transcript, "model_id": "eleven_multilingual_v2"}, timeout=45)
    response.raise_for_status()
    return response.content


def itinerary(windows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not windows:
        return []
    places = [{"spot": w.get("spot"), "caption": w.get("caption_t"), "note": w.get("context_note"), "date": w.get("local_date")} for w in windows]
    text = chat(
        "itinerary",
        [{"role": "system", "content": 'Create 4–6 itinerary stops across 2 days using only place names in the supplied windows. Tips are short and in the partner\'s voice, reusing their words where possible. Return a JSON object with a "stops" array; each item has day (integer 1 or 2), place, and tip.'}, {"role": "user", "content": json.dumps(places, ensure_ascii=False)}],
        model="gpt-4o-mini", max_tokens=700, json_object=True,
    )
    parsed = json.loads(text or "{}")
    stops = parsed if isinstance(parsed, list) else parsed.get("stops", [])
    return stops[:6]


# ---------- bond: how close two pen pals have become ----------
# Same thresholds as app/src/lib/bond.ts. Worked out only from what they've done together.
BOND_LEVELS = [
    {"level": 1, "name": "New pen pals", "letters": 0, "together": 0},
    {"level": 2, "name": "Regular correspondents", "letters": 4, "together": 1},
    {"level": 3, "name": "Close pen pals", "letters": 12, "together": 3},
    {"level": 4, "name": "Old friends", "letters": 30, "together": 8},
]


def bond_level(letters: int, together: int) -> int:
    level = 1
    for step in BOND_LEVELS[1:]:
        if letters >= step["letters"] and together >= step["together"]:
            level = step["level"]
    return level


def _json_call(system: str, user: str, schema: dict[str, Any], name: str, max_tokens: int = 400) -> dict[str, Any]:
    text = chat(name, [{"role": "system", "content": system}, {"role": "user", "content": user}], model="gpt-4o-mini", max_tokens=max_tokens, schema=schema)
    return json.loads(text or "{}")


def daily_prompt(a: dict[str, Any], b: dict[str, Any], level: int, recent_themes: list[str], recent_letters: list[str]) -> dict[str, Any]:
    """Today's shared photo prompt for a pen pal pair, in each person's language."""
    shared = [x for x in (a.get("interests") or []) if x.casefold() in {y.casefold() for y in (b.get("interests") or [])}]
    facts = {
        "person_a": {"name": a.get("name"), "city": a.get("home_city"), "interests": a.get("interests") or []},
        "person_b": {"name": b.get("name"), "city": b.get("home_city"), "interests": b.get("interests") or []},
        "shared_interests": shared,
        "recent_themes_do_not_repeat": recent_themes[:10],
        "recent_letters": recent_letters[:6],
    }
    lang_a = (a.get("languages") or ["en"])[0]
    lang_b = (b.get("languages") or ["en"])[0]
    return _json_call(daily_prompt_system(lang_a, lang_b, level), json.dumps(facts, ensure_ascii=False), DAILY_PROMPT_SCHEMA, "daily_prompt")


def remember(previous: str | None, letter: dict[str, Any], sender: str, reader: str, city: str, lang: str) -> dict[str, Any]:
    """Rewrite the reader's portrait of the sender's city with one new letter; maybe name a moment stamp."""
    user = json.dumps({"portrait_so_far": previous or "", "new_letter": letter}, ensure_ascii=False)
    return _json_call(memory_system(sender, reader, city, lang), user, MEMORY_SCHEMA, "memory", max_tokens=300)


def localize(text: str, lang: str) -> str:
    """Short UI strings (stamp titles) into someone's language. English passes straight through."""
    if not text or lang.startswith("en"):
        return text
    result = chat(
        "localize",
        [{"role": "system", "content": f"Translate this short passport-stamp title into {lang}. Keep names. Reply with the translation only."}, {"role": "user", "content": text}],
        model="gpt-4o-mini", max_tokens=60, effort="minimal",
    )
    return result or text
