from __future__ import annotations

import asyncio
from typing import Iterable

try:
    from gpiozero import Buzzer, PWMOutputDevice, RGBLED
except Exception:
    Buzzer = PWMOutputDevice = RGBLED = None


class RGBTimeLight:
    def __init__(self, config: dict, simulate: bool = False):
        self.simulate = simulate
        self.brightness = float(config.get("brightness", 0.55))
        self.last_color: tuple[float, float, float] | None = None

        if simulate:
            self.led = None
            return

        if RGBLED is None:
            raise RuntimeError("gpiozero is not available")

        common = config.get("common", "cathode").lower()
        if common not in ("cathode", "anode"):
            raise ValueError("rgb_led.common must be 'cathode' or 'anode'")

        self.led = RGBLED(
            red=int(config["red_pin"]),
            green=int(config["green_pin"]),
            blue=int(config["blue_pin"]),
            active_high=(common == "cathode"),
            pwm=True,
            initial_value=(0, 0, 0),
        )

    def set_color(self, rgb: tuple[float, float, float]) -> None:
        scaled = tuple(
            max(0.0, min(1.0, channel * self.brightness))
            for channel in rgb
        )

        if self.last_color == scaled:
            return

        self.last_color = scaled

        if self.simulate:
            print(f"[SIM] RGB = {tuple(round(v, 3) for v in scaled)}")
        else:
            self.led.color = scaled

    def close(self) -> None:
        if self.led is not None:
            self.led.off()
            self.led.close()


class BuzzerOutput:
    def __init__(self, config: dict, simulate: bool = False):
        self.simulate = simulate
        self.mode = config.get("type", "active").lower()
        self.pin = int(config.get("pin", 18))
        self.frequency_hz = int(config.get("frequency_hz", 2000))
        self.pulse_ms = int(config.get("pulse_ms", 75))
        self.device = None

        if simulate:
            return

        if Buzzer is None or PWMOutputDevice is None:
            raise RuntimeError("gpiozero is not available")

        if self.mode == "active":
            self.device = Buzzer(self.pin)
        elif self.mode == "passive":
            self.device = PWMOutputDevice(
                self.pin,
                active_high=True,
                initial_value=0.0,
                frequency=self.frequency_hz,
            )
        else:
            raise ValueError("buzzer.type must be 'active' or 'passive'")

    async def pulse(self, duration_ms: int | None = None) -> None:
        duration_ms = duration_ms or self.pulse_ms

        if self.simulate:
            print("BEEP", flush=True)
            await asyncio.sleep(duration_ms / 1000)
            return

        if self.mode == "active":
            self.device.on()
        else:
            self.device.value = 0.5

        await asyncio.sleep(duration_ms / 1000)

        if self.mode == "active":
            self.device.off()
        else:
            self.device.value = 0.0

    async def play_pattern(self, intervals_ms: Iterable[int]) -> None:
        intervals = list(intervals_ms)

        for index, delay_ms in enumerate(intervals):
            if index > 0:
                await asyncio.sleep(max(0, delay_ms) / 1000)
            await self.pulse()

    def close(self) -> None:
        if self.device is not None:
            self.device.off()
            self.device.close()
