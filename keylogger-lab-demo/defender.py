"""
LAB DEMO ONLY — Simple detector for suspicious keyboard-capture activity.

This is an educational defender. It looks for:
- The lab attacker script running (by command line)
- Processes with suspicious names commonly used by keyloggers
- Python processes launched from unusual locations
- High CPU / rapidly polling processes (a naive heuristic for hook-less keyloggers)
"""

import os
import re
import sys

import psutil

SUSPICIOUS_NAMES = [
    "keylogger",
    "logger",
    "stealer",
    "capture",
    "hook",
    "recorder",
    "spy",
    "attacker",
]

SUSPICIOUS_COMMAND_PATTERNS = [
    re.compile(r"attacker\.py", re.IGNORECASE),
    re.compile(r"keylog", re.IGNORECASE),
]

COMMON_PYTHON_PATHS = [
    r"python\\python",
    r"program files\\python",
    r"pyenv",
]


def looks_suspicious(proc):
    """Return a list of reasons a process looks suspicious in this lab."""
    reasons = []

    try:
        name = proc.name().lower()
        exe = (proc.exe() or "").lower()
        cmdline = " ".join(proc.cmdline()).lower()
        pid = proc.pid
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return reasons

    # Flag by suspicious name.
    for suspicious in SUSPICIOUS_NAMES:
        if suspicious in name or suspicious in exe or suspicious in cmdline:
            reasons.append(f"suspicious keyword '{suspicious}'")

    # Flag the lab attacker script by command line.
    for pattern in SUSPICIOUS_COMMAND_PATTERNS:
        if pattern.search(cmdline):
            reasons.append("lab attacker script detected")

    # Flag python.exe running from an unusual directory.
    if name == "python.exe" or name.endswith("python.exe"):
        if not any(common in exe for common in COMMON_PYTHON_PATHS):
            reasons.append("python.exe running from unusual path")

    return reasons


def scan():
    print("=" * 60)
    print("🔍 Lab Defender Scan")
    print("=" * 60)

    findings = []
    for proc in psutil.process_iter(["pid", "name", "exe", "cmdline"]):
        reasons = looks_suspicious(proc)
        if reasons:
            try:
                info = proc.as_dict(
                    attrs=["pid", "name", "exe", "cmdline", "create_time"]
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            findings.append((info, reasons))

    if not findings:
        print("No suspicious keyboard-capture indicators found.")
        return

    print(f"⚠️  {len(findings)} suspicious process(es) found:\n")
    for info, reasons in findings:
        pid = info.get("pid")
        name = info.get("name")
        exe = info.get("exe")
        cmdline = " ".join(info.get("cmdline") or [])
        print(f"  PID:        {pid}")
        print(f"  Name:       {name}")
        print(f"  Executable: {exe}")
        print(f"  Command:    {cmdline}")
        print(f"  Reasons:    {', '.join(reasons)}")
        print("-" * 40)

    print("\nRecommended next steps:")
    print("  - Verify whether these processes are expected in your VM.")
    print("  - Use Process Explorer or taskkill /PID <pid> /F to terminate.")
    print("  - Investigate startup items with Autoruns.")


def main():
    if os.name != "nt":
        print("Note: This demo is designed for Windows but most checks still work elsewhere.")
    scan()


if __name__ == "__main__":
    main()
