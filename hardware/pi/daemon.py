from __future__ import annotations

import argparse
import asyncio
import json
import signal
import time
from pathlib import Path

from accelerometer import KnockDetector, make_accelerometer
from api_client import WindowAPI
from hardware import BuzzerOutput, RGBTimeLight
from time_light import partner_time_and_color


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    temp.replace(path)


def load_state(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


async def light_loop(
    api: WindowAPI,
    light: RGBTimeLight,
    fallback_tz: str,
    stop: asyncio.Event,
) -> None:
    partner_tz = fallback_tz
    next_partner_refresh = 0.0

    while not stop.is_set():
        now = time.monotonic()

        if now >= next_partner_refresh:
            try:
                partner = await api.get_partner()
                if partner.get("timezone"):
                    partner_tz = partner["timezone"]
                next_partner_refresh = now + 30.0
            except Exception as exc:
                print(f"[light] partner lookup failed: {exc}")
                next_partner_refresh = now + 5.0

        local, color = partner_time_and_color(partner_tz)
        light.set_color(color)
        print(
            f"[light] partner timezone={partner_tz} "
            f"local={local.strftime('%Y-%m-%d %H:%M:%S %Z')}",
            flush=True,
        )

        try:
            await asyncio.wait_for(stop.wait(), timeout=30.0)
        except asyncio.TimeoutError:
            pass


async def receive_loop(
    api: WindowAPI,
    buzzer: BuzzerOutput,
    playback_active: asyncio.Event,
    state_file: Path,
    poll_interval_seconds: float,
    retry_seconds: float,
    stop: asyncio.Event,
) -> None:
    state = load_state(state_file)
    after_id = state.get("last_event_id")

    if not isinstance(after_id, int):
        while not stop.is_set():
            try:
                after_id = await api.get_cursor()
                save_state(state_file, {"last_event_id": after_id})
                break
            except Exception as exc:
                print(f"[receive] could not initialize cursor: {exc}")
                await asyncio.sleep(retry_seconds)

    while not stop.is_set():
        try:
            events = await api.wait_for_knocks(
                after_id,
                poll_interval_seconds,
                stop,
            )

            for event in events:
                event_id = int(event["id"])
                pattern = [int(v) for v in event["intervals_ms"]]
                print(f"[receive] event={event_id} pattern={pattern}", flush=True)

                playback_active.set()
                try:
                    await buzzer.play_pattern(pattern)
                    await asyncio.sleep(0.30)
                finally:
                    playback_active.clear()

                after_id = max(after_id, event_id)
                save_state(state_file, {"last_event_id": after_id})

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[receive] Supabase/playback error: {exc}", flush=True)
            await asyncio.sleep(retry_seconds)


async def upload_sequence(
    api: WindowAPI,
    knock_times: list[float],
    retry_seconds: float,
) -> None:
    if not knock_times:
        return

    intervals = [0]
    for previous, current in zip(knock_times, knock_times[1:]):
        intervals.append(max(0, int(round(current - previous))))

    intervals = [min(10_000, value) for value in intervals]
    print(f"[send] pattern={intervals}", flush=True)

    try:
        result = await api.send_knocks(intervals)
        print(f"[send] uploaded event={result['id']}", flush=True)
    except Exception as exc:
        print(f"[send] upload failed: {exc}", flush=True)
        await asyncio.sleep(retry_seconds)


async def detector_loop(
    api: WindowAPI,
    accelerometer,
    detector: KnockDetector,
    playback_active: asyncio.Event,
    sample_hz: float,
    sequence_gap_ms: int,
    max_knocks: int,
    retry_seconds: float,
    stop: asyncio.Event,
) -> None:
    sample_period = 1.0 / max(1.0, sample_hz)
    knock_times: list[float] = []

    while not stop.is_set():
        tick_start = time.monotonic()
        now_ms = tick_start * 1000.0

        if playback_active.is_set():
            knock_times.clear()
        else:
            try:
                xyz = accelerometer.read_accel_g()
                is_knock, impact = detector.update(xyz, now_ms)

                if is_knock:
                    knock_times.append(now_ms)
                    print(
                        f"[knock] detected impact={impact:.3f}g "
                        f"count={len(knock_times)}",
                        flush=True,
                    )

                    if len(knock_times) >= max_knocks:
                        await upload_sequence(api, knock_times, retry_seconds)
                        knock_times.clear()

                if knock_times and (now_ms - knock_times[-1]) >= sequence_gap_ms:
                    await upload_sequence(api, knock_times, retry_seconds)
                    knock_times.clear()

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                print(f"[sensor] error: {exc}", flush=True)
                await asyncio.sleep(retry_seconds)

        elapsed = time.monotonic() - tick_start
        await asyncio.sleep(max(0.0, sample_period - elapsed))


async def simulation_input_loop(api: WindowAPI, stop: asyncio.Event) -> None:
    print("[SIM] Press Enter to send [0, 180, 520]. Ctrl+C to stop.")

    while not stop.is_set():
        try:
            await asyncio.to_thread(input)
        except (EOFError, KeyboardInterrupt):
            return

        try:
            result = await api.send_knocks([0, 180, 520])
            print(f"[SIM] uploaded event={result['id']}", flush=True)
        except Exception as exc:
            print(f"[SIM] send failed: {exc}", flush=True)


async def run(config_path: Path, simulate: bool) -> None:
    config = load_json(config_path)

    side = str(config["side"]).upper()
    if side not in ("A", "B"):
        raise ValueError("config.side must be A or B")

    network = config.get("network", {})
    poll_interval_seconds = float(network.get("poll_interval_ms", 450)) / 1000.0
    retry_seconds = float(network.get("retry_seconds", 2))

    api = WindowAPI(
        supabase_url=config["supabase_url"],
        publishable_key=config["supabase_publishable_key"],
        pair_id=config["pair_id"],
        pair_secret=config["pair_secret"],
        side=side,
        timeout_seconds=10.0,
    )

    accelerometer = make_accelerometer(
        config["accelerometer"],
        simulate=simulate,
    )
    buzzer = BuzzerOutput(config["buzzer"], simulate=simulate)
    light = RGBTimeLight(config["rgb_led"], simulate=simulate)

    kd = config.get("knock_detection", {})
    detector = KnockDetector(
        threshold_g=float(kd.get("threshold_g", 0.35)),
        debounce_ms=int(kd.get("debounce_ms", 120)),
    )

    state_file = Path(config.get("state_file", "./window_state.json"))
    if not state_file.is_absolute():
        state_file = config_path.parent / state_file

    stop = asyncio.Event()
    playback_active = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass

    tasks = [
        asyncio.create_task(
            light_loop(
                api,
                light,
                config.get("fallback_partner_timezone", "UTC"),
                stop,
            ),
            name="time-light",
        ),
        asyncio.create_task(
            receive_loop(
                api,
                buzzer,
                playback_active,
                state_file,
                poll_interval_seconds,
                retry_seconds,
                stop,
            ),
            name="receive-knocks",
        ),
        asyncio.create_task(
            detector_loop(
                api,
                accelerometer,
                detector,
                playback_active,
                sample_hz=float(kd.get("sample_hz", 100)),
                sequence_gap_ms=int(kd.get("sequence_gap_ms", 900)),
                max_knocks=int(kd.get("max_knocks", 12)),
                retry_seconds=retry_seconds,
                stop=stop,
            ),
            name="detect-knocks",
        ),
    ]

    if simulate:
        tasks.append(
            asyncio.create_task(
                simulation_input_loop(api, stop),
                name="simulation-input",
            )
        )

    print(
        f"Window daemon started: side={side} "
        f"supabase={config['supabase_url']} simulate={simulate}",
        flush=True,
    )

    try:
        await stop.wait()
    finally:
        for task in tasks:
            task.cancel()

        await asyncio.gather(*tasks, return_exceptions=True)

        accelerometer.close()
        buzzer.close()
        light.close()
        await api.close()
        print("Window daemon stopped.", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--simulate", action="store_true")
    args = parser.parse_args()

    asyncio.run(
        run(
            Path(args.config).resolve(),
            simulate=args.simulate,
        )
    )


if __name__ == "__main__":
    main()
