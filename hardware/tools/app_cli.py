from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request


def rpc(
    supabase_url: str,
    publishable_key: str,
    function: str,
    params: dict,
):
    request = urllib.request.Request(
        supabase_url.rstrip("/") + f"/rest/v1/rpc/{function}",
        data=json.dumps(params).encode("utf-8"),
        method="POST",
        headers={
            "apikey": publishable_key,
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code}: {detail}") from exc


def pair_params(args, include_side=True) -> dict:
    if not args.pair_id or not args.secret:
        raise SystemExit("--pair-id and --secret are required")

    params = {
        "p_pair_id": args.pair_id,
        "p_pair_secret": args.secret,
    }

    if include_side:
        if not args.side:
            raise SystemExit("--side A or --side B is required")
        params["p_side"] = args.side

    return params


def main():
    parser = argparse.ArgumentParser(description="Window Sync Supabase CLI")
    parser.add_argument("--supabase-url", required=True)
    parser.add_argument("--publishable-key", required=True)
    parser.add_argument("--pair-id")
    parser.add_argument("--secret")
    parser.add_argument("--side", choices=["A", "B"])

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("create-pair")

    tz = sub.add_parser("timezone")
    tz.add_argument("name")

    knock = sub.add_parser("knock")
    knock.add_argument("intervals", type=int, nargs="+")

    sub.add_parser("partner")
    sub.add_parser("cursor")

    receive = sub.add_parser("receive")
    receive.add_argument("--after-id", type=int, default=0)

    args = parser.parse_args()

    if args.command == "create-pair":
        result = rpc(
            args.supabase_url,
            args.publishable_key,
            "window_create_pair",
            {},
        )

    elif args.command == "timezone":
        params = pair_params(args)
        params["p_timezone"] = args.name
        result = rpc(
            args.supabase_url,
            args.publishable_key,
            "window_set_timezone",
            params,
        )

    elif args.command == "knock":
        params = pair_params(args)
        params["p_intervals_ms"] = args.intervals
        result = rpc(
            args.supabase_url,
            args.publishable_key,
            "window_send_knock",
            params,
        )

    elif args.command == "partner":
        result = rpc(
            args.supabase_url,
            args.publishable_key,
            "window_get_partner",
            pair_params(args),
        )

    elif args.command == "cursor":
        result = rpc(
            args.supabase_url,
            args.publishable_key,
            "window_get_knock_cursor",
            pair_params(args, include_side=False),
        )

    else:
        params = pair_params(args)
        params["p_after_id"] = args.after_id
        params["p_limit"] = 25
        result = rpc(
            args.supabase_url,
            args.publishable_key,
            "window_get_knocks",
            params,
        )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
