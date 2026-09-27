"""Load a week of past letters between the two demo accounts (sid + isha), through the real AI pipeline.

    python demo_history.py "/Users/siddutta/Desktop/Window Video/demo-history" --yes

The folder holds the photos (and any voice memos) plus letters.json, a list of letters oldest first:

    [
      {"day": 6, "from": "isha", "photo": "isha/1.jpg", "caption": "my walk to class", "spot": "Tech Green"},
      {"day": 5, "from": "sid", "photo": "sid/2.jpg", "caption": "mi café de la mañana", "prompt": "coffee",
       "voice": "sid/2.m4a", "time": "08:10"}
    ]

  day     how many days ago it was sent (6 = six days ago)
  from    "sid" or "isha"
  photo   path inside the folder (jpg, png or heic; resized to 1600 px)
  caption what they wrote, in their own language (optional)
  spot    a public place for the map pin (optional)
  voice   a voice memo (m4a) inside the folder (optional)
  prompt  a theme both answered that day, e.g. "coffee" (optional). Letters on the same day with the same
          theme share one AI-written daily prompt, and both answering it earns a "together" stamp.
  time    local time it was sent, "HH:MM" in the sender's city (optional)

What it does, in order:
  1. clears the pair's letters, stamps, portraits, prompts and knocks (a fresh start), and dates their match
     a week back;
  2. for each letter: uploads it exactly like the app does, dates it in the past, and runs the same pipeline
     a live letter gets (safety check, voice to text, Muse Spark translation / labels / travel note /
     write-back, then the memory step: city portrait + stamps); no phone notifications are sent;
  3. marks everything as the preloaded demo, so the app's "Reset demo" button returns to exactly this.

Needs server/.env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, and for Meta
AI_PROVIDER=meta + META_API_KEY (same values as on Render). Always uses the fixed demo roles (sid in Atlanta, isha in Cancún).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

# server/.env wins over anything already set in the terminal (e.g. an old key exported in ~/.zshrc)
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

import main
import ai
from db import get_supabase


def fail(message: str) -> None:
    sys.exit(f"\n✗ {message}")


def load_letters(folder: Path) -> list[dict[str, Any]]:
    path = folder / "letters.json"
    if not path.exists():
        fail(f"{path} not found. See the top of this file for the format.")
    letters = json.loads(path.read_text())
    for i, letter in enumerate(letters, 1):
        for key in ("day", "from", "photo"):
            if key not in letter:
                fail(f"letter {i} is missing \"{key}\"")
        if letter["from"] not in ("sid", "isha"):
            fail(f"letter {i}: \"from\" must be sid or isha")
        for key in ("photo", "voice"):
            if letter.get(key) and not (folder / letter[key]).exists():
                fail(f"letter {i}: file not found: {letter[key]}")
    # oldest first; on the same day, keep the order written in the file
    return sorted(letters, key=lambda x: -int(x["day"]))


def as_jpeg(path: Path) -> bytes:
    """Resize to 1600 px and convert to JPEG (macOS sips handles HEIC from iPhones)."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "photo.jpg"
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "85", "-Z", "1600", str(path), "--out", str(out)],
                       check=True, capture_output=True)
        return out.read_bytes()


def sent_at(letter: dict[str, Any], tz: str) -> datetime:
    zone = ZoneInfo(tz or "UTC")
    hour, minute = (int(x) for x in (letter.get("time") or "09:00").split(":"))
    day = (datetime.now(zone) - timedelta(days=int(letter["day"]))).date()
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=zone)


def main_cli() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", help="folder with letters.json, photos and voice memos")
    parser.add_argument("--yes", action="store_true", help="really replace the demo pair's letters")
    args = parser.parse_args()
    folder = Path(args.folder).expanduser()
    letters = load_letters(folder)

    for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            fail(f"{key} is not set. Put it in server/.env (copy the value from Render → Environment).")
    print(f"AI provider: {ai.provider()}")

    sb = get_supabase()
    ids = main.demo_account_ids()
    if len(ids) < 2:
        fail("both demo accounts (sid and isha) must exist")
    before = {name: main.profile(user_id).get("home_city") for name, user_id in ids.items()}
    people = {name: {**main.profile(user_id), **main.DEMO_ROLES[name]} for name, user_id in ids.items()}
    pair = [m for m in main.rows("matches") if {m.get("user_a"), m.get("user_b")} == set(ids.values())]
    if not pair:
        fail("sid and isha aren't matched. Match them in the app first.")
    match = max(pair, key=lambda m: m.get("created_at") or "")
    for name, p in people.items():
        note = "" if before[name] == p["home_city"] else f"  (profile says {before[name]}; will be set back to {p['home_city']})"
        print(f"  {name:5} writes from {p['home_city']} in {p['languages'][0]}{note}")
    print(f"  {len(letters)} letters over {max(int(x['day']) for x in letters)} days")
    if not args.yes:
        print("\nNothing changed. Run again with --yes to replace the pair's letters with this history.")
        return

    # the demo roles are fixed (sid in Atlanta, isha in Cancún): set them now and again at the end
    main.enforce_demo_roles(ids)
    try:
        load(sb, ids, people, match, letters, folder)
    finally:
        main.enforce_demo_roles(ids)
        now = {name: main.profile(user_id).get("home_city") for name, user_id in ids.items()}
        print(f"  demo roles: sid lives in {now.get('sid')}, isha lives in {now.get('isha')}")


def load(sb: Any, ids: dict[str, str], people: dict[str, dict[str, Any]], match: dict[str, Any], letters: list[dict[str, Any]], folder: Path) -> None:
    # 1) fresh start
    mid = match["id"]
    for table in ("windows", "stamps", "portraits", "daily_prompts"):
        sb.table(table).delete().eq("match_id", mid).execute()
    sb.table("knocks").delete().in_("from_user", list(ids.values())).in_("to_user", list(ids.values())).execute()
    for other in main.rows("matches"):  # anyone else they matched with while demoing
        if other["id"] != mid and other.get("status") in ("active", "paused") and set(ids.values()) & {other.get("user_a"), other.get("user_b")}:
            sb.table("matches").update({"status": "ended"}).eq("id", other["id"]).execute()
    first_day = max(int(x["day"]) for x in letters)
    sb.table("matches").update({
        "status": "active", "itinerary": None,
        "created_at": (datetime.now(ZoneInfo("UTC")) - timedelta(days=first_day + 1)).isoformat(),
    }).eq("id", mid).execute()
    main.send_push = lambda *a, **k: False  # the past doesn't buzz anyone's phone

    # 2) letters, oldest first
    prompts: dict[tuple[int, str], str] = {}
    a, b = main.profile(match["user_a"]), main.profile(match["user_b"])
    for n, letter in enumerate(letters, 1):
        sender = people[letter["from"]]
        recipient = people["isha" if letter["from"] == "sid" else "sid"]
        when = sent_at(letter, sender.get("tz") or "UTC")
        prompt_id = None
        if letter.get("prompt"):
            key = (int(letter["day"]), str(letter["prompt"]).lower())
            if key not in prompts:
                sofar = main.rows("windows", match_id=mid)
                answered: dict[str, set[str]] = {}
                for w in sofar:
                    if w.get("prompt_id"):
                        answered.setdefault(w["prompt_id"], set()).add(w["sender_id"])
                level = ai.bond_level(len(sofar), sum(1 for s in answered.values() if len(s) >= 2))
                themes = [r.get("theme") for r in main.rows("daily_prompts", match_id=mid) if r.get("theme")]
                generated = ai.daily_prompt(a, b, level, themes, [], theme=str(letter["prompt"]))
                row = sb.table("daily_prompts").insert({
                    "match_id": mid, "prompt_date": when.date().isoformat(), "level": level, **generated,
                }).execute().data[0]
                prompts[key] = row["id"]
                print(f"  prompt ({when:%a}): {generated.get('text_a')}")
            prompt_id = prompts[key]

        window_id = str(uuid.uuid4())
        photo_path = f"{sender['id']}/{window_id}.jpg"
        sb.storage.from_("media").upload(photo_path, as_jpeg(folder / letter["photo"]), {"content-type": "image/jpeg", "upsert": "true"})
        audio_path = None
        if letter.get("voice"):
            audio_path = f"{sender['id']}/{window_id}.m4a"
            sb.storage.from_("media").upload(audio_path, (folder / letter["voice"]).read_bytes(), {"content-type": "audio/mp4", "upsert": "true"})
        sb.table("windows").insert({
            "id": window_id, "match_id": mid, "sender_id": sender["id"], "recipient_id": recipient["id"],
            "photo_path": photo_path, "audio_path": audio_path, "caption": letter.get("caption") or "",
            "spot": letter.get("spot") or None, "local_date": when.date().isoformat(),
            "created_at": when.isoformat(), "prompt_id": prompt_id, "demo_seed": True,
        }).execute()

        main.process_pipeline(window_id)  # the same pipeline a live letter gets
        result = main.one("window_translations", window_id=window_id) or {}
        status = result.get("status")
        print(f"  {n:2}/{len(letters)} {letter['from']:4} {when:%a %H:%M}  {status:8} {(result.get('caption_t') or '')[:60]}")
        if status != "ready":
            fail(f"letter {n} ended as {status}: {result.get('error') or 'blocked by the safety check'}")

    # 3) this is the demo's starting point: Reset demo comes back here
    sb.table("stamps").update({"demo_seed": True}).eq("match_id", mid).execute()
    for portrait in main.rows("portraits", match_id=mid):
        sb.table("portraits").update({"demo_text": portrait["text"], "demo_letters": portrait.get("letters") or 0}) \
            .eq("match_id", mid).eq("reader_id", portrait["reader_id"]).execute()
    sb.table("matches").update({"itinerary": None}).eq("id", mid).execute()
    stamps = main.rows("stamps", match_id=mid)
    print(f"\n✓ Loaded {len(letters)} letters, {len(prompts)} shared prompts, {len(stamps)} stamps. "
          "Open the app (pull down or reopen) to see the history.")


if __name__ == "__main__":
    main_cli()
