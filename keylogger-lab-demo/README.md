# Keylogger Lab Demo — Controlled Attack/Defense

> **WARNING: This is a defensive security lab demo only.**  
> Run it exclusively inside an isolated virtual machine with no sensitive data, no personal accounts, and no network access to production systems. The attacker script intentionally captures keystrokes so you can test the defender.

## What this demo contains

| File | Purpose |
|------|---------|
| `attacker.py` | A **visible, non-stealth** keystroke-capture demo. It shows a big warning banner, logs keys to a local file, and stops on `Ctrl + C`. |
| `defender.py` | A detector that scans running processes and flags suspicious indicators, including the lab attacker. |
| `requirements.txt` | Python dependencies. |

## Lab setup (VM strongly recommended)

1. Install a Windows VM (VirtualBox, VMware, or Hyper-V).
2. Take a **snapshot** before running anything.
3. Install Python 3.x.
4. Copy this folder into the VM.
5. Open an admin PowerShell or Command Prompt in this folder.
6. Install dependencies:
   ```powershell
   python -m pip install -r requirements.txt
   ```
7. Disable network access in the VM if possible.

## Running the lab

### 1. Start the defender

```powershell
python defender.py
```

It will scan the system and print a report. Run it before and after starting the attacker to compare.

### 2. Start the attacker in a second terminal

```powershell
python attacker.py
```

Read the warning banner. Type a few keys inside the VM. The attacker logs them to `lab_capture.log`.

### 3. Re-run the defender

```powershell
python defender.py
```

The defender should flag the attacker process.

### 4. Stop the attacker

Press `Ctrl + C` in the attacker window, or close the terminal.

## Safety rules

- Never run `attacker.py` outside the lab VM.
- Never distribute the attacker script.
- Do not add persistence, stealth, obfuscation, or network exfiltration.
- Delete the VM snapshot or revert when done.

## Extending the demo

Good next steps for defensive research:

- Detect low-level Windows hooks (`SetWindowsHookEx`, `WH_KEYBOARD_LL`) using `NtQuerySystemInformation` or API hooking tools.
- Monitor for new `python.exe` processes spawned from unusual paths.
- Use Sysinternals `Process Explorer` / `Autoruns` to inspect loaded DLLs and startup entries.
- Build a simple HIDS rule that alerts when `attacker.py` or unknown Python scripts start.

## Disclaimer

This code is provided for authorized, educational security research only. Unauthorized keystroke logging is illegal in most jurisdictions. The authors assume no liability for misuse.
