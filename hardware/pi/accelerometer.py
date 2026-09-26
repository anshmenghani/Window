from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Protocol

from smbus2 import SMBus


class Accelerometer(Protocol):
    def read_accel_g(self) -> tuple[float, float, float]:
        ...

    def close(self) -> None:
        ...


def _signed16(msb: int, lsb: int) -> int:
    value = (msb << 8) | lsb
    return value - 65536 if value & 0x8000 else value


def _signed16_le(lsb: int, msb: int) -> int:
    return _signed16(msb, lsb)


class MPU6050:
    PWR_MGMT_1 = 0x6B
    ACCEL_XOUT_H = 0x3B
    ACCEL_CONFIG = 0x1C

    def __init__(self, bus: int = 1, address: int = 0x68):
        self.bus = SMBus(bus)
        self.address = address
        self.bus.write_byte_data(self.address, self.PWR_MGMT_1, 0x00)
        self.bus.write_byte_data(self.address, self.ACCEL_CONFIG, 0x00)
        self.scale = 16384.0

    def read_accel_g(self) -> tuple[float, float, float]:
        data = self.bus.read_i2c_block_data(self.address, self.ACCEL_XOUT_H, 6)
        return (
            _signed16(data[0], data[1]) / self.scale,
            _signed16(data[2], data[3]) / self.scale,
            _signed16(data[4], data[5]) / self.scale,
        )

    def close(self) -> None:
        self.bus.close()


class ADXL345:
    POWER_CTL = 0x2D
    DATA_FORMAT = 0x31
    DATAX0 = 0x32

    def __init__(self, bus: int = 1, address: int = 0x53):
        self.bus = SMBus(bus)
        self.address = address
        self.bus.write_byte_data(self.address, self.POWER_CTL, 0x08)
        self.bus.write_byte_data(self.address, self.DATA_FORMAT, 0x08)
        self.scale_g_per_lsb = 0.0039

    def read_accel_g(self) -> tuple[float, float, float]:
        data = self.bus.read_i2c_block_data(self.address, self.DATAX0, 6)
        return (
            _signed16_le(data[0], data[1]) * self.scale_g_per_lsb,
            _signed16_le(data[2], data[3]) * self.scale_g_per_lsb,
            _signed16_le(data[4], data[5]) * self.scale_g_per_lsb,
        )

    def close(self) -> None:
        self.bus.close()


class FakeAccelerometer:
    def read_accel_g(self) -> tuple[float, float, float]:
        return (
            random.uniform(-0.006, 0.006),
            random.uniform(-0.006, 0.006),
            1.0 + random.uniform(-0.006, 0.006),
        )

    def close(self) -> None:
        pass


def make_accelerometer(config: dict, simulate: bool = False) -> Accelerometer:
    if simulate:
        return FakeAccelerometer()

    kind = config.get("type", "mpu6050").lower()
    bus = int(config.get("bus", 1))
    raw_address = config.get("address", "0x68")
    address = int(raw_address, 0) if isinstance(raw_address, str) else int(raw_address)

    if kind == "mpu6050":
        return MPU6050(bus=bus, address=address)
    if kind == "adxl345":
        return ADXL345(bus=bus, address=address)

    raise ValueError(f"Unsupported accelerometer type: {kind}")


@dataclass
class KnockDetector:
    threshold_g: float = 0.35
    debounce_ms: int = 120
    baseline_alpha: float = 0.01

    def __post_init__(self) -> None:
        self.baseline: float | None = None
        self.last_knock_ms: float = -1e12

    def update(self, xyz_g: tuple[float, float, float], now_ms: float) -> tuple[bool, float]:
        x, y, z = xyz_g
        magnitude = math.sqrt(x * x + y * y + z * z)

        if self.baseline is None:
            self.baseline = magnitude

        impact = abs(magnitude - self.baseline)

        if impact < self.threshold_g:
            self.baseline = (
                (1.0 - self.baseline_alpha) * self.baseline
                + self.baseline_alpha * magnitude
            )

        is_knock = (
            impact >= self.threshold_g
            and (now_ms - self.last_knock_ms) >= self.debounce_ms
        )

        if is_knock:
            self.last_knock_ms = now_ms

        return is_knock, impact
