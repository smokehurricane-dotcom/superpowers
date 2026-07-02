<#
.SYNOPSIS
    Keystroke-capture PoC for authorized penetration testing / red team engagements.

.DESCRIPTION
    Polls key state via the Win32 GetAsyncKeyState API and writes timestamped
    keystrokes, together with the foreground window title, to a local log file.
    Intended to demonstrate impact of a user-level foothold (e.g. lack of EDR
    keylogger detection, insufficient endpoint hardening) during an engagement
    for which you hold written authorization. Stop and remove this script at
    the end of the engagement window per your rules of engagement.

.PARAMETER LogPath
    File to append captured keystrokes to. Defaults to a file in the current
    user's temp directory.

.PARAMETER PollIntervalMs
    How often (ms) to poll key state. Lower = more accurate, more CPU.

.PARAMETER DurationSeconds
    Optional. If set, the logger stops automatically after this many seconds
    instead of running until Ctrl+C. Useful for time-boxed PoC demonstrations.

.NOTES
    Run only against systems and for durations covered by a signed authorization
    / scope document. This script performs no exfiltration, no persistence, and
    no anti-detection evasion by design -- add those only if explicitly in scope
    and operate them under your engagement's data-handling rules.

.EXAMPLE
    .\keylogger-poc.ps1 -LogPath C:\poc\keylog.txt -DurationSeconds 60
#>

param(
    [string]$LogPath = (Join-Path $env:TEMP