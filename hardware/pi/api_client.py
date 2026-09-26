from __future__ import annotations

import asyncio
import httpx


class WindowAPI:
    """
    Direct client for Supabase's Data API / Postgres RPC endpoint.
    Uses the publishable key only; the pair secret is checked in database functions.
    """

    def __init__(
        self,
        supabase_url: str,
        publishable_key: str,
        pair_id: str,
        pair_secret: str,
        side: str,
        timeout_seconds: float = 10.0,
    ):
        self.pair_id = pair_id
        self.pair_secret = pair_secret
        self.side = side.upper()

        self.client = httpx.AsyncClient(
            base_url=supabase_url.rstrip("/") + "/rest/v1",
            headers={
                "apikey": publishable_key,
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(timeout_seconds),
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def _rpc(self, name: str, params: dict) -> dict:
        response = await self.client.post(f"/rpc/{name}", json=params)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
            return data[0]

        if not isinstance(data, dict):
            raise RuntimeError(f"Unexpected RPC response from {name}: {data!r}")

        return data

    async def get_partner(self) -> dict:
        return await self._rpc(
            "window_get_partner",
            {
                "p_pair_id": self.pair_id,
                "p_pair_secret": self.pair_secret,
                "p_side": self.side,
            },
        )

    async def set_timezone(self, timezone_name: str) -> dict:
        return await self._rpc(
            "window_set_timezone",
            {
                "p_pair_id": self.pair_id,
                "p_pair_secret": self.pair_secret,
                "p_side": self.side,
                "p_timezone": timezone_name,
            },
        )

    async def send_knocks(self, intervals_ms: list[int]) -> dict:
        return await self._rpc(
            "window_send_knock",
            {
                "p_pair_id": self.pair_id,
                "p_pair_secret": self.pair_secret,
                "p_side": self.side,
                "p_intervals_ms": intervals_ms,
            },
        )

    async def get_cursor(self) -> int:
        result = await self._rpc(
            "window_get_knock_cursor",
            {
                "p_pair_id": self.pair_id,
                "p_pair_secret": self.pair_secret,
            },
        )
        return int(result["cursor"])

    async def get_knocks(self, after_id: int) -> list[dict]:
        result = await self._rpc(
            "window_get_knocks",
            {
                "p_pair_id": self.pair_id,
                "p_pair_secret": self.pair_secret,
                "p_side": self.side,
                "p_after_id": after_id,
                "p_limit": 25,
            },
        )
        return result["events"]

    async def wait_for_knocks(
        self,
        after_id: int,
        poll_interval_seconds: float,
        stop_event: asyncio.Event | None = None,
    ) -> list[dict]:
        while stop_event is None or not stop_event.is_set():
            events = await self.get_knocks(after_id)
            if events:
                return events

            if stop_event is None:
                await asyncio.sleep(poll_interval_seconds)
            else:
                try:
                    await asyncio.wait_for(
                        stop_event.wait(),
                        timeout=poll_interval_seconds,
                    )
                except asyncio.TimeoutError:
                    pass

        return []
