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
    },
    "required": ["caption_t", "transcript_t", "context_note", "stickers", "spot_suggestion"],
    "additionalProperties": False,
}


def window_system_prompt(src: str, lang: str, city: str, country: str) -> str:
    return f"""You help two pen pals in different countries understand each other's daily photo.
Translate the caption and transcript from {src} into {lang}, naturally and casually. If the languages are the same, copy them unchanged.
Write context_note in {lang}, at most 45 words, explaining something actually visible in the photo in the context of {city}, {country}. Be warm and specific, avoid stereotypes, and never invent facts. If unsure, describe what is visible.
Return up to 3 clearly visible, nameable objects as stickers. Put word in {src} script, reading as romanization (same as word for Latin script), meaning in {lang}, and x/y as the object's center fractions of image width/height.
Set spot_suggestion only when a well-known public place is clearly recognizable. Never guess a home or school; otherwise use null."""
