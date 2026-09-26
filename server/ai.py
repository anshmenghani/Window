import json
import os
import re
from typing import Any

import httpx
from openai import OpenAI

from prompts import (
    DAILY_PROMPT_SCHEMA, MEMORY_SCHEMA, WINDOW_SCHEMA, daily_prompt_system, memory_system, window_system_prompt,
)


def client() -> OpenAI:
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


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
    result = client().chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": request}], max_tokens=80)
    return (result.choices[0].message.content or "You share a curiosity for discovering new places.").strip()


def moderate(caption: str, photo_url: str) -> bool:
    response = client().moderations.create(
        model="omni-moderation-latest",
        input=[{"type": "text", "text": caption}, {"type": "image_url", "image_url": {"url": photo_url}}],
    )
    return bool(response.results[0].flagged)


def transcribe(audio: bytes) -> str:
    result = client().audio.transcriptions.create(model="whisper-1", file=("voice.m4a", audio, "audio/mp4"))
    return result.text


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
    response = client().chat.completions.create(
        model="gpt-4o", messages=[{"role": "system", "content": prompt}, {"role": "user", "content": content}],
        response_format={"type": "json_schema", "json_schema": {"name": "window_translation", "strict": True, "schema": WINDOW_SCHEMA}},
        max_tokens=800,
    )
    parsed = json.loads(response.choices[0].message.content or "{}")
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
    response = client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": 'Create 4–6 itinerary stops across 2 days using only place names in the supplied windows. Tips are short and in the partner\'s voice, reusing their words where possible. Return a JSON object with a "stops" array; each item has day (integer 1 or 2), place, and tip.'}, {"role": "user", "content": json.dumps(places, ensure_ascii=False)}],
        response_format={"type": "json_object"}, max_tokens=700,
    )
    parsed = json.loads(response.choices[0].message.content or "{}")
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
    response = client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}},
        max_tokens=max_tokens,
    )
    return json.loads(response.choices[0].message.content or "{}")


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
    result = client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": f"Translate this short passport-stamp title into {lang}. Keep names. Reply with the translation only."}, {"role": "user", "content": text}],
        max_tokens=60,
    )
    return (result.choices[0].message.content or text).strip()
