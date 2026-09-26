import asyncio
import hmac
import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

import ai
from db import get_supabase

load_dotenv()
app = FastAPI(title="Window API", version="1.0.0")
bearer = HTTPBearer(auto_error=False)


def require_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    try:
        user = get_supabase().auth.get_user(credentials.credentials).user
        if not user:
            raise ValueError("missing user")
        return user.id
    except Exception as error:
        print(f"[auth] token check failed: {type(error).__name__}: {str(error)[:200]}", flush=True)
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")


def rows(table: str, **filters: Any) -> list[dict[str, Any]]:
    query = get_supabase().table(table).select("*")
    for key, value in filters.items():
        query = query.eq(key, value)
    return query.execute().data or []


def one(table: str, **filters: Any) -> dict[str, Any] | None:
    result = rows(table, **filters)
    return result[0] if result else None


def profile(user_id: str) -> dict[str, Any]:
    result = one("profiles", id=user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return result


@app.get("/health")
def health(db: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {"ok": True, "ai": ai.provider()}
    if db:
        # /health?db=1 checks the server can reach Supabase with its own keys (no data returned)
        try:
            get_supabase().table("profiles").select("id").limit(1).execute()
            get_supabase().auth.admin.list_users(page=1, per_page=1)
            result["db"] = "ok"
        except Exception as error:
            result["db"] = f"{type(error).__name__}: {str(error)[:160]}"
    return result


@app.post("/match")
def match(_user: str = Depends(require_user)) -> list[dict[str, Any]]:
    sb = get_supabase()
    me = profile(_user)
    if not me.get("onboarded"):
        raise HTTPException(status_code=409, detail="Finish your profile before finding a match.")
    my_vec = me.get("interest_vec") or ai.embed_interests(me.get("interests") or [])
    if not me.get("interest_vec"):
        sb.table("profiles").update({"interest_vec": my_vec}).eq("id", _user).execute()
    all_matches = rows("matches")
    existing = [m for m in all_matches if m.get("status") in ("active", "paused")]
    current = [m for m in existing if _user in (m.get("user_a"), m.get("user_b"))]
    if current:
        m = max(current, key=lambda item: item.get("created_at") or "")
        partner = profile(m["user_b"] if m["user_a"] == _user else m["user_a"])
        return [{"city": m["city"], "status": "matched", "match": {**m, "partner": partner}}]

    blocked = rows("blocks")
    blocked_pairs = {(b["blocker_id"], b["blocked_id"]) for b in blocked}
    occupied = {m.get("user_a") for m in existing} | {m.get("user_b") for m in existing}
    dreams = (me.get("dream_places") or [])[:3]
    scored: list[tuple[float, dict[str, Any], str, list[str], bool]] = []
    for city in dreams:
        for candidate in rows("profiles", home_city=city, onboarded=True):
            candidate_id = candidate.get("id")
            if not candidate_id or candidate_id == _user or candidate_id in occupied:
                continue
            if (_user, candidate_id) in blocked_pairs or (candidate_id, _user) in blocked_pairs:
                continue
            their_vec = candidate.get("interest_vec") or ai.embed_interests(candidate.get("interests") or [])
            if not candidate.get("interest_vec"):
                sb.table("profiles").update({"interest_vec": their_vec}).eq("id", candidate_id).execute()
            mine = {x.casefold(): x for x in (me.get("interests") or [])}
            shared = [mine[x.casefold()] for x in candidate.get("interests", []) if x.casefold() in mine]
            mutual = bool(candidate.get("mutual_dreams", True) and me.get("home_city") in (candidate.get("dream_places") or []))
            score = ai.cosine(my_vec, their_vec) + (0.15 if mutual else 0)
            scored.append((score, candidate, city, shared, mutual))
    if not scored:
        return [{"city": city, "status": "waiting"} for city in dreams]

    _, partner, city, shared, mutual = max(scored, key=lambda item: item[0])
    reason = ai.fit_reason(me, partner, shared[:3], mutual)
    try:
        inserted = sb.table("matches").insert({"user_a": _user, "user_b": partner["id"], "city": city, "reason": reason, "status": "active"}).execute().data[0]
    except Exception:
        # The database serialises concurrent match creation. If another request
        # won the race for this user, return that match instead of surfacing a
        # server error to the matching screen.
        current = [m for m in rows("matches") if m.get("status") in ("active", "paused") and _user in (m.get("user_a"), m.get("user_b"))]
        if current:
            inserted = max(current, key=lambda item: item.get("created_at") or "")
            partner = profile(inserted["user_b"] if inserted["user_a"] == _user else inserted["user_a"])
            return [{"city": inserted["city"], "status": "matched", "match": {**inserted, "partner": partner}}]
        return [{"city": dream, "status": "waiting"} for dream in dreams]
    return [{"city": city, "status": "matched", "match": {**inserted, "partner": partner}}]


VERIFY_RADIUS_KM = 80


class LocationRequest(BaseModel):
    lat: float
    lng: float


@app.post("/verify-location")
def verify_location(body: LocationRequest, user_id: str = Depends(require_user)) -> dict[str, Any]:
    """Check the phone is near the chosen home city. Coordinates are never stored or logged."""
    me = profile(user_id)
    if me.get("lat") is None or me.get("lng") is None:
        raise HTTPException(status_code=409, detail="Pick your home city first.")
    if not (-90 <= body.lat <= 90 and -180 <= body.lng <= 180):
        raise HTTPException(status_code=422, detail="That location doesn't look right.")
    distance = ai.distance_km(body.lat, body.lng, float(me["lat"]), float(me["lng"]))
    verified = distance <= VERIFY_RADIUS_KM
    if verified:
        get_supabase().table("profiles").update(
            {"location_verified": True, "location_verified_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id).execute()
    return {"verified": verified, "distance_km": round(distance)}


class ProcessRequest(BaseModel):
    window_id: UUID


@app.post("/process-window", status_code=202)
def process_window(body: ProcessRequest, background: BackgroundTasks, user_id: str = Depends(require_user)) -> dict[str, bool]:
    window = one("windows", id=str(body.window_id))
    if not window or window.get("sender_id") != user_id:
        raise HTTPException(status_code=404, detail="Window not found.")
    match_row = one("matches", id=window["match_id"])
    if not match_row or match_row.get("status") != "active":
        raise HTTPException(status_code=409, detail="This pen pal window is not active.")
    if not (
        (match_row.get("user_a") == user_id and match_row.get("user_b") == window.get("recipient_id"))
        or (match_row.get("user_b") == user_id and match_row.get("user_a") == window.get("recipient_id"))
    ):
        raise HTTPException(status_code=409, detail="This window does not belong to the active match.")
    background.add_task(process_pipeline, str(body.window_id))
    return {"ok": True}


def update_translation(window_id: str, fields: dict[str, Any]) -> None:
    get_supabase().table("window_translations").update(fields).eq("window_id", window_id).execute()


def process_pipeline(window_id: str) -> None:
    sb = get_supabase()
    try:
        window = one("windows", id=window_id)
        if not window:
            raise RuntimeError("Window not found")
        match_row = one("matches", id=window["match_id"])
        sender, recipient = profile(window["sender_id"]), profile(window["recipient_id"])
        translation = {
            "window_id": window_id, "match_id": window["match_id"], "recipient_id": window["recipient_id"],
            "src_lang": (sender.get("languages") or ["en"])[0], "lang": (recipient.get("languages") or ["en"])[0],
            "status": "processing", "steps": {}, "error": None,
        }
        sb.table("window_translations").upsert(translation).execute()
        photo_url = sb.storage.from_("media").get_public_url(window["photo_path"])
        if ai.moderate(window.get("caption") or "", photo_url):
            update_translation(window_id, {"status": "blocked", "steps": {"safety": False}})
            return
        steps = {"safety": True}
        update_translation(window_id, {"steps": steps})

        transcript = None
        if window.get("audio_path"):
            audio_url = sb.storage.from_("media").get_public_url(window["audio_path"])
            with httpx.Client(timeout=45) as http:
                response = http.get(audio_url)
                response.raise_for_status()
            languages = (sender.get("languages") or []) + (recipient.get("languages") or [])
            places = [sender.get("home_city"), (match_row or {}).get("city"), window.get("spot")]
            transcript = ai.transcribe(response.content, languages, [p for p in places if p])
        steps["transcribed"] = True
        update_translation(window_id, {"transcript": transcript, "steps": steps})

        caption = window.get("caption") or ""
        if sender.get("hide_contact") and match_row:
            created = datetime.fromisoformat(match_row["created_at"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - created).days < 7:
                caption = ai.hide_contact(caption)
                transcript = ai.hide_contact(transcript) if transcript else None
                sb.table("windows").update({"caption": caption}).eq("id", window_id).execute()
        translated = ai.translate_window(photo_url, caption, transcript, translation["src_lang"], translation["lang"], sender.get("home_city") or "", sender.get("country") or "")
        steps["translated"] = True
        fields = {**translated, "transcript": transcript, "steps": steps}
        update_translation(window_id, fields)

        spot = window.get("spot") or translated.get("spot_suggestion")
        if spot:
            spot_fields: dict[str, Any] = {"spot": spot}
            try:
                coords = asyncio.run(ai.geocode(spot, (match_row or {}).get("city") or sender.get("home_city") or ""))
                if coords:
                    spot_fields.update({"spot_lat": coords[0], "spot_lng": coords[1]})
            except Exception:
                pass
            sb.table("windows").update(spot_fields).eq("id", window_id).execute()

        dub = ai.dub_transcript(window_id, translated.get("transcript_t") or "")
        if dub:
            path = f"dubs/{window_id}.mp3"
            sb.storage.from_("media").upload(path, dub, {"content-type": "audio/mpeg", "upsert": "true"})
            fields = {"dub_path": path}
            steps["voiced"] = True
            fields["steps"] = steps
            update_translation(window_id, fields)
        update_translation(window_id, {"status": "ready", "steps": steps, "error": None})
        try:
            remember_letter(window, match_row or {}, sender, recipient, translated, spot)
        except Exception:
            pass  # memories are a bonus; a delivered window never fails because of them
    except Exception as exc:
        try:
            update_translation(window_id, {"status": "failed", "error": str(exc)[:1000]})
        except Exception:
            pass


def stamp_date(local_date: str | None) -> str:
    try:
        return datetime.fromisoformat(str(local_date)).strftime("%b %d").upper()
    except Exception:
        return datetime.now(timezone.utc).strftime("%b %d").upper()


def remember_letter(window: dict[str, Any], match_row: dict[str, Any], sender: dict[str, Any], recipient: dict[str, Any], translated: dict[str, Any], spot: str | None) -> None:
    """After a window is delivered: update the reader's portrait of the sender's city and award memory stamps."""
    sb = get_supabase()
    match_id = window["match_id"]
    sender_name, reader_name = sender.get("name") or "Your pen pal", recipient.get("name") or "you"
    reader_lang = (recipient.get("languages") or ["en"])[0]
    sender_lang = (sender.get("languages") or ["en"])[0]
    letters = rows("windows", match_id=match_id)
    from_sender = [w for w in letters if w.get("sender_id") == window["sender_id"]]
    date = stamp_date(window.get("local_date"))
    now = datetime.now(timezone.utc).isoformat()

    # 1) "Their city, as you know it", rewritten with this letter (in the reader's language)
    previous = one("portraits", match_id=match_id, reader_id=recipient["id"])
    letter = {
        "caption": translated.get("caption_t"), "voice_note": translated.get("transcript_t"),
        "travel_note": translated.get("context_note"), "place": spot, "date": str(window.get("local_date")),
    }
    memory = ai.remember((previous or {}).get("text"), letter, sender_name, reader_name, sender.get("home_city") or "", reader_lang)
    if memory.get("portrait"):
        sb.table("portraits").upsert({
            "match_id": match_id, "reader_id": recipient["id"], "subject_id": sender["id"],
            "text": memory["portrait"], "letters": len(from_sender), "updated_at": now,
        }).execute()

    stamps: list[dict[str, Any]] = []

    def add(owner: dict[str, Any], kind: str, title: str, dedupe: str, sub: str = date, translate: bool = True) -> None:
        lang = (owner.get("languages") or ["en"])[0]
        stamps.append({
            "match_id": match_id, "owner_id": owner["id"], "kind": kind, "window_id": window["id"], "dedupe": dedupe, "sub": sub,
            "title": ai.localize(title, lang) if translate else title,
        })

    # 2) a place or moment worth remembering (the reader has now "been" there)
    if memory.get("stamp"):
        earlier = [x for x in rows("stamps", match_id=match_id, owner_id=recipient["id"]) if x.get("kind") in ("place", "moment")]
        if len(earlier) <= len(from_sender) // 2:  # keep them special: roughly one per two letters at most
            add(recipient, "place", memory["stamp"], f"window:{window['id']}", translate=False)

    # 3) the very first letter between them
    if len(letters) == 1:
        add(recipient, "first", f"First letter from {sender_name}", "first")
        add(sender, "first", f"Your first letter to {reader_name}", "first")

    # 4) the first time one of them sent their voice
    if window.get("audio_path") and not any(w.get("audio_path") for w in from_sender if w["id"] != window["id"]):
        add(recipient, "voice", f"First time you heard {sender_name}'s voice", f"voice:{sender['id']}")
        add(sender, "voice", f"{reader_name} heard your voice", f"voice:{sender['id']}")

    # 5) they both answered the same daily prompt
    if window.get("prompt_id"):
        answered = {w.get("sender_id") for w in letters if w.get("prompt_id") == window["prompt_id"]}
        prompt = one("daily_prompts", id=window["prompt_id"])
        if prompt and len(answered) >= 2:
            km = 0
            if None not in (sender.get("lat"), sender.get("lng"), recipient.get("lat"), recipient.get("lng")):
                km = int(round(ai.distance_km(sender["lat"], sender["lng"], recipient["lat"], recipient["lng"]), -2))
            sub = f"{date} · {km:,} KM APART" if km else date
            for person in (sender, recipient):
                side = "a" if person["id"] == match_row.get("user_a") else "b"
                add(person, "together", prompt.get(f"stamp_{side}") or prompt.get("stamp_a") or "Together", f"prompt:{prompt['id']}", sub=sub, translate=False)

    if stamps:
        sb.table("stamps").upsert(stamps, on_conflict="match_id,owner_id,dedupe", ignore_duplicates=True).execute()


class PromptRequest(BaseModel):
    match_id: UUID


@app.post("/prompt")
def todays_prompt(body: PromptRequest, user_id: str = Depends(require_user)) -> dict[str, Any] | None:
    """Today's shared prompt for a pen pal pair. Written once per day (UTC) from what they share and how close they are."""
    sb = get_supabase()
    match_row = one("matches", id=str(body.match_id))
    if not match_row or user_id not in (match_row.get("user_a"), match_row.get("user_b")):
        raise HTTPException(status_code=404, detail="Match not found.")
    if match_row.get("status") == "ended":
        return None
    today = datetime.now(timezone.utc).date().isoformat()
    letters = rows("windows", match_id=match_row["id"])
    prompt = one("daily_prompts", match_id=match_row["id"], prompt_date=today)
    if not prompt:
        a, b = profile(match_row["user_a"]), profile(match_row["user_b"])
        senders_by_prompt: dict[str, set[str]] = {}
        for w in letters:
            if w.get("prompt_id"):
                senders_by_prompt.setdefault(w["prompt_id"], set()).add(w["sender_id"])
        together = sum(1 for s in senders_by_prompt.values() if len(s) >= 2)
        level = ai.bond_level(len(letters), together)
        recent = sb.table("daily_prompts").select("theme").eq("match_id", match_row["id"]).order("prompt_date", desc=True).limit(10).execute().data or []
        translations = {t["window_id"]: t for t in rows("window_translations", match_id=match_row["id"])}
        names = {a["id"]: a.get("name") or "A", b["id"]: b.get("name") or "B"}
        recent_letters = [
            f"{names.get(w['sender_id'], '')}: {(translations.get(w['id']) or {}).get('caption_t') or w.get('caption') or ''}"
            for w in sorted(letters, key=lambda x: x.get("created_at") or "", reverse=True)[:6]
        ]
        generated = ai.daily_prompt(a, b, level, [r["theme"] for r in recent if r.get("theme")], recent_letters)
        sb.table("daily_prompts").upsert(
            {"match_id": match_row["id"], "prompt_date": today, "level": level, **generated},
            on_conflict="match_id,prompt_date", ignore_duplicates=True,
        ).execute()
        prompt = one("daily_prompts", match_id=match_row["id"], prompt_date=today)
    if not prompt:
        return None
    side = "a" if user_id == match_row["user_a"] else "b"
    partner_id = match_row["user_b"] if side == "a" else match_row["user_a"]
    answered = {w.get("sender_id") for w in letters if w.get("prompt_id") == prompt["id"]}
    return {
        "id": prompt["id"], "match_id": prompt["match_id"], "prompt_date": str(prompt["prompt_date"]),
        "text": prompt.get(f"text_{side}"), "why": prompt.get(f"why_{side}"), "level": prompt.get("level") or 1,
        "answered_by_me": user_id in answered, "answered_by_them": partner_id in answered,
    }


class ItineraryRequest(BaseModel):
    match_id: UUID


@app.post("/itinerary")
def get_itinerary(body: ItineraryRequest, user_id: str = Depends(require_user)) -> list[dict[str, Any]]:
    sb = get_supabase()
    match_row = one("matches", id=str(body.match_id))
    if not match_row or user_id not in (match_row.get("user_a"), match_row.get("user_b")):
        raise HTTPException(status_code=404, detail="Match not found.")
    if match_row.get("itinerary"):
        return match_row["itinerary"]
    partner_id = match_row["user_b"] if match_row["user_a"] == user_id else match_row["user_a"]
    partner_windows = [w for w in rows("windows", match_id=str(body.match_id), sender_id=partner_id)]
    ready_ids = {t["window_id"] for t in rows("window_translations") if t.get("status") == "ready"}
    eligible = [w for w in partner_windows if w["id"] in ready_ids]
    saved = [w for w in eligible if w.get("saved")]
    selected = saved or eligible
    translations = {t["window_id"]: t for t in rows("window_translations") if t.get("window_id") in {w["id"] for w in selected}}
    inputs = [{**w, **translations.get(w["id"], {})} for w in selected]
    result = ai.itinerary(inputs)
    sb.table("matches").update({"itinerary": result}).eq("id", str(body.match_id)).execute()
    return result


@app.post("/hooks/push")
def push_hook(payload: dict[str, Any], x_hook_secret: str | None = Header(default=None)) -> dict[str, bool]:
    secret = os.getenv("HOOK_SECRET", "")
    if not secret or not x_hook_secret or not hmac.compare_digest(secret, x_hook_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook secret.")
    record, old = payload.get("record") or {}, payload.get("old_record") or {}
    table = payload.get("table")
    if table == "knocks" and payload.get("type") == "INSERT":
        recipient_id = record.get("to_user")
        sender = profile(record.get("from_user", ""))
        title, body, data = "Knock knock", f"{sender.get('name') or 'Someone'} knocked on your window", {"type": "knock", "id": record.get("id")}
    elif table == "window_translations" and record.get("status") == "ready" and old.get("status") != "ready":
        recipient_id = record.get("recipient_id")
        window = one("windows", id=record.get("window_id"))
        sender = profile(window["sender_id"]) if window else {}
        title = f"{sender.get('name') or 'Your partner'}'s window arrived"
        body = f"A new window from {sender.get('home_city') or 'your partner'}"
        data = {"type": "window", "id": record.get("window_id")}
    else:
        return {"ok": True}
    token_row = one("push_tokens", user_id=recipient_id)
    token = (token_row or {}).get("token") or profile(recipient_id).get("expo_push_token")
    if token:
        response = httpx.post("https://exp.host/--/api/v2/push/send", json={"to": token, "title": title, "body": body, "sound": "default", "data": data}, timeout=10)
        response.raise_for_status()
    return {"ok": True}
