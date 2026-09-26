from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


ANCHORS = [
    (0.0,  (0.03, 0.00, 0.10)),
    (5.0,  (0.08, 0.01, 0.16)),
    (7.0,  (1.00, 0.20, 0.03)),
    (9.0,  (0.35, 0.55, 1.00)),
    (15.0, (0.18, 0.48, 1.00)),
    (18.5, (1.00, 0.28, 0.02)),
    (21.0, (0.30, 0.03, 0.35)),
    (24.0, (0.03, 0.00, 0.10)),
]


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def color_for_hour(hour: float) -> tuple[float, float, float]:
    hour %= 24.0

    for (h0, c0), (h1, c1) in zip(ANCHORS, ANCHORS[1:]):
        if h0 <= hour <= h1:
            span = h1 - h0
            t = 0.0 if span == 0 else (hour - h0) / span
            return tuple(_lerp(a, b, t) for a, b in zip(c0, c1))

    return ANCHORS[-1][1]


def partner_time_and_color(
    timezone_name: str,
    now_utc: datetime | None = None,
) -> tuple[datetime, tuple[float, float, float]]:
    try:
        tz = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        tz = timezone.utc

    now_utc = now_utc or datetime.now(timezone.utc)
    local = now_utc.astimezone(tz)
    fractional_hour = local.hour + local.minute / 60 + local.second / 3600
    return local, color_for_hour(fractional_hour)
