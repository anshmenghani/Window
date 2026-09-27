from machine import Pin
from time import sleep

GPIO_NUMBERS = (11, 12, 13)
COMMON_ANODE = True

OFF = 1 if COMMON_ANODE else 0
ON = 0 if COMMON_ANODE else 1
pins = []

try:
    for number in GPIO_NUMBERS:
        pins.append(Pin(number, Pin.OUT, value=OFF))

    while True:
        for number, pin in zip(GPIO_NUMBERS, pins):
            print("GP%d ON — note the color you see" % number)
            pin.value(ON)
            sleep(3)
            pin.value(OFF)
            print("All OFF")
            sleep(1)
except KeyboardInterrupt:
    print("Test stopped")
finally:
    for pin in pins:
        pin.value(OFF)
