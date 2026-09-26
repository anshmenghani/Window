"""Check your Meta key works before switching the server over.

    META_API_KEY='LLM|...' python check_meta.py

Runs one text call, one photo call and one voice-note transcription through Meta only (no OpenAI
fallback), and prints what came back. Costs well under a cent.
"""
import json
import os
import subprocess
import sys
import tempfile

os.environ["AI_PROVIDER"] = "meta"
if not (os.getenv("META_API_KEY") or os.getenv("MODEL_API_KEY")):
    sys.exit("Set META_API_KEY first, e.g.  META_API_KEY='LLM|...' python check_meta.py")

import ai  # noqa: E402

PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Kamo_River_in_Kyoto.jpg/1280px-Kamo_River_in_Kyoto.jpg"

print("1. Muse Spark, text ...")
reply = ai.meta_client().chat.completions.create(
    model=ai.META_CHAT_MODEL, messages=[{"role": "user", "content": "Reply with the single word: ready"}],
    reasoning_effort="minimal", max_completion_tokens=2000,
)
print("   ", reply.choices[0].message.content)

print("2. Muse Spark, photo + the real letter schema ...")
from prompts import WINDOW_SCHEMA, window_system_prompt  # noqa: E402
reply = ai.meta_client().chat.completions.create(
    model=ai.META_CHAT_MODEL,
    messages=[
        {"role": "system", "content": window_system_prompt("ja", "en", "Kyoto", "Japan")},
        {"role": "user", "content": [
            {"type": "text", "text": "Caption: 夕方はみんな鴨川に座る\nTranscript: [absent: no voice note was sent]"},
            {"type": "image_url", "image_url": {"url": PHOTO}},
        ]},
    ],
    response_format={"type": "json_schema", "json_schema": {"name": "window_translation", "schema": WINDOW_SCHEMA}},
    reasoning_effort="low", max_completion_tokens=4800,
)
print(json.dumps(json.loads(reply.choices[0].message.content), ensure_ascii=False, indent=2))

print("3. Muse Voice Transcribe ...")
with tempfile.TemporaryDirectory() as folder:
    path = os.path.join(folder, "voice.aiff")
    subprocess.run(["say", "-v", "Kyoko", "-o", path, "おはよう。今日は鴨川で散歩しました。"], check=True)
    with open(path, "rb") as audio:
        print("   ", ai._meta_transcribe(audio.read(), ["ja", "en"], ["Kyoto", "Kamo River"]))
print("All three worked.")
