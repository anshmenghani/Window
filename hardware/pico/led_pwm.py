from machine import Pin
from rp2 import PIO, StateMachine, asm_pio


@asm_pio(sideset_init=PIO.OUT_LOW)
def _led_pwm():
    pull(noblock).side(0)
    mov(x, osr)
    mov(y, isr)
    label("count")
    jmp(x_not_y, "next")
    nop().side(1)
    label("next")
    jmp(y_dec, "count")


class PIOPWM:
    def __init__(self, state_machine, pin, duty_u16):
        self.sm = StateMachine(state_machine, _led_pwm, freq=2000000,
                               sideset_base=Pin(pin))
        self.active = False
        self.last_duty = None
        self.sm.put(255)
        self.sm.exec("pull()")
        self.sm.exec("mov(isr, osr)")
        self.duty_u16(duty_u16)

    def duty_u16(self, value):
        value = max(0, min(65535, int(value)))
        if value == self.last_duty:
            return
        self.last_duty = value
        if value in (0, 65535):
            self.sm.active(0)
            self.active = False
            self.sm.exec("nop().side(%d)" % (1 if value else 0))
        else:
            # The counter value 0 produces a narrow pulse; 255 is almost full on.
            self.sm.put(max(0, min(255, round(value * 256 / 65535) - 1)))
            if not self.active:
                self.sm.active(1)
                self.active = True

    def deinit(self):
        self.sm.active(0)
        self.active = False
