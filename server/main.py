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
    except Exception:
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
def health() -> dict[str, bool]:
    return {"ok": True}


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
    inserted = sb.table("matches").insert({"user_a": _user, "user_b": partner["id"], "city": city, "reason": reason, "status": "active"}).execute().data[0]
    return [{"city": city, "status": "matched", "match": {**inserted, "partner": partner}}]


class ProcessRequest(BaseModel):
    window_id: UUID


@app.post("/process-window", status_code=202)
def process_window(body: ProcessRequest, background: BackgroundTasks, user_id: str = Depends(require_user)) -> dict[str, bool]:
    window = one("windows", id=str(body.window_id))
    if not window or window.get("sender_id") != user_id:
        raise HTTPException(status_code=404, detail="Window not found.")
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
            transcript = ai.transcribe(response.content)
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
    except Exception as exc:
        try:
            update_translation(window_id, {"status": "failed", "error": str(exc)[:1000]})
        except Exception:
            pass


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
