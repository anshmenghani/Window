WINDOW_SCHEMA = {
    "type": "object",
    "properties": {
        "caption_t": {"type": "string"},
        "transcript_t": {"type": ["string", "null"]},
        "context_note": {"type": "string"},
        "stickers": {
            "type": "array", "maxItems": 3,
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "word": {"type": "string"}, "reading": {"type": "string"},
                    "meaning": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"},
                },
                "required": ["word", "reading", "meaning", "x", "y"],
            },
        },
        "spot_suggestion": {"type": ["string", "null"]},
        "reply_prompt": {"type": "string"},
    },
    "required": ["caption_t", "transcript_t", "context_note", "stickers", "spot_suggestion", "reply_prompt"],
    "additionalProperties": False,
}


def window_system_prompt(src: str, lang: str, city: str, country: str) -> str:
    return f"""You help two pen pals in different countries understand each other's daily photo.
Translate the caption and transcript from {src} into {lang}, naturally and casually. If the languages are the same, copy them unchanged.
If the user message says the transcript is absent, set transcript_t to null. Never invent a transcript.
Write context_note in {lang}, at most 45 words, explaining something actually visible in the photo in the context of {city}, {country}. Be warm and specific, avoid stereotypes, and never invent facts. If unsure, describe what is visible.
Return up to 3 clearly visible, nameable objects as stickers. Put word in {src} script, reading as romanization (same as word for Latin script), meaning in {lang}, and x/y as the object's center fractions of image width/height.
Set spot_suggestion only when a well-known public place is clearly recognizable. Never guess a home or school; otherwise use null.
Write reply_prompt in {lang}: one warm sentence (at most 22 words) inviting the reader to answer with their own world, tied to something specific in this photo or caption. Example: "She showed you where Kyoto gathers at sunset. Where does your city gather?" Never ask for faces, home, school, workplace or anything identifying."""


# ---------- daily shared prompt ----------
DAILY_PROMPT_SCHEMA = {
    "type": "object",
    "properties": {
        "theme": {"type": "string"},
        "text_a": {"type": "string"}, "why_a": {"type": "string"}, "stamp_a": {"type": "string"},
        "text_b": {"type": "string"}, "why_b": {"type": "string"}, "stamp_b": {"type": "string"},
    },
    "required": ["theme", "text_a", "why_a", "stamp_a", "text_b", "why_b", "stamp_b"],
    "additionalProperties": False,
}

LEVEL_GUIDE = {
    1: "New pen pals: light and everyday. Lean on an interest they share (their coffee, their street, lunch, the view from a bus).",
    2: "Regular correspondents: routines and places they go often (a walk they take, where they study, their favorite corner).",
    3: "Close pen pals: more personal (a place that matters to them, something they made, a small ritual, a comfort food).",
    4: "Old friends: meaningful (a view they'd want the other to see in person, somewhere tied to a memory, what home feels like).",
}


def daily_prompt_system(lang_a: str, lang_b: str, level: int) -> str:
    return f"""You write ONE daily photo prompt for two pen pals in different countries. Each sends one photo a day, and today they both answer the same prompt, so it must work in both cities.
Their closeness: {LEVEL_GUIDE.get(level, LEVEL_GUIDE[1])}
Prefer an interest they share when it fits naturally. You may build on something from their recent letters. Never repeat a recent theme. If required_theme is given, the prompt must be about exactly that.
Never ask for faces or people, their home, school, workplace, or anything identifying or unsafe.
text: one short sentence addressed to both, like "Show each other your coffee today."
why: one short line saying why this prompt is for them, like "You both love coffee."
stamp: a 2 to 5 word passport-stamp title celebrating that they both answered, like "Two cups of coffee".
theme: one or two English words naming the subject (used to avoid repeats).
Write text_a, why_a and stamp_a in {lang_a}; write text_b, why_b and stamp_b in {lang_b}. Same meaning in both."""


# ---------- memory: the portrait of their city, and moment stamps ----------
MEMORY_SCHEMA = {
    "type": "object",
    "properties": {
        "portrait": {"type": "string"},
        "stamp": {"type": ["string", "null"]},
    },
    "required": ["portrait", "stamp"],
    "additionalProperties": False,
}


def memory_system(sender: str, reader: str, city: str, lang: str) -> str:
    return f"""You keep a short portrait of {sender}'s {city} as {reader} has come to know it through {sender}'s daily photos and notes.
Update the portrait with the new letter. Use ONLY facts from the letters (captions, voice notes, travel notes, places). Never invent details, people or feelings.
Warm and specific, 2 to 4 sentences, at most 70 words, third person about {sender} (e.g. "{sender}'s mornings start at..."). Write it in {lang}.
Also decide if this new letter shows a distinct place or moment worth a passport stamp: a named place or a vivid, specific scene. Be selective; most everyday letters get null.
If yes, stamp is a 2 to 5 word title in {lang}, like "Kamo River at sunset". Otherwise stamp is null."""
