from machine import Pin, SoftI2C
from time import sleep_ms


class Sensor:
    def __init__(self, config):
        self.i2c = SoftI2C(sda=Pin(config.get("sda", 18)),
                          scl=Pin(config.get("scl", 19)),
                          freq=config.get("frequency", 50000))
        sleep_ms(200)
        devices = self.i2c.scan()
        self.address = next((a for a in (0x1C, 0x1D) if a in devices), None)
        if self.address is None:
            raise RuntimeError("MMA845x missing; check configured SDA/SCL pins (default GP18/GP19), 3V3 OUT and GND")
        chip_id = self.read_register(0x0D)[0]
        settings = {0x1A: (2, 4096), 0x2A: (4, 1024), 0x3A: (6, 256)}
        if chip_id not in settings:
            raise RuntimeError("Unknown accelerometer ID: " + hex(chip_id))
        self.shift, self.counts_per_g = settings[chip_id]
        self.write_register(0x2A, 0)
        self.write_register(0x0E, 0)
        self.write_register(0x2A, 1)
        print("[sensor] MMA845x", hex(chip_id))

    def read_register(self, register, length=1):
        self.i2c.writeto(self.address, bytes([register]), False)
        return self.i2c.readfrom(self.address, length)

    def write_register(self, register, value):
        self.i2c.writeto(self.address, bytes([register, value]))

    def read(self):
        data = self.read_register(1, 6)
        values = []
        for i in range(0, 6, 2):
            raw = (data[i] << 8) | data[i + 1]
            if raw & 0x8000:
                raw -= 65536
            values.append((raw >> self.shift) / self.counts_per_g)
        return values

    def calibrate(self):
        print("[sensor] Calibrating: keep the window still")
        baseline = [0, 0, 0]
        for _ in range(50):
            xyz = self.read()
            for i in range(3):
                baseline[i] += xyz[i] / 50
            sleep_ms(20)
        return baseline
