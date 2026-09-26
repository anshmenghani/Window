"""Fill demo persona profiles after creating the accounts in Supabase Auth.

Set PERSONAS_JSON to a JSON array. Each entry needs an existing Auth user `id` and
the public persona fields. This avoids storing demo passwords or inventing Auth users.
"""
import json
import os

from dotenv import load_dotenv

import ai
from db import get_supabase

load_dotenv()


def main() -> None:
    raw = os.getenv("PERSONAS_JSON")
    if not raw:
        raise SystemExit("Set PERSONAS_JSON to the list of existing persona profile records first.")
    personas = json.loads(raw)
    sb = get_supabase()
    for persona in personas:
        required = {"id", "name", "home_city", "country", "tz", "lat", "lng", "languages", "interests"}
        missing = required - persona.keys()
        if missing:
            raise SystemExit(f"Persona {persona.get('name', '<unnamed>')} is missing: {', '.join(sorted(missing))}")
        record = {
            **persona,
            "onboarded": True,
            "dream_places": persona.get("dream_places") or ["Atlanta"],
            "mutual_dreams": persona.get("mutual_dreams", True),
            "hide_contact": persona.get("hide_contact", True),
            "interest_vec": ai.embed_interests(persona.get("interests") or []),
        }
        sb.table("profiles").upsert(record).execute()
        print(f"Seeded {persona['name']} ({persona['home_city']})")


if __name__ == "__main__":
    main()
