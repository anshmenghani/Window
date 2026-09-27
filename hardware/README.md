# Window hardware

The current physical Window uses a Raspberry Pi Pico W, an MMA845x
accelerometer, an SG90 servo and a common-anode RGB LED.

Start with [pico/README.md](pico/README.md). It contains the wiring, Pico upload
list, database migration order and two-device test procedure.

The files in `supabase/` define the shared hardware tables and RPCs. The
`tools/app_cli.py` utility creates a hardware pair and can send test requests
from a computer. The former Linux Raspberry Pi 3 daemon has been removed.
