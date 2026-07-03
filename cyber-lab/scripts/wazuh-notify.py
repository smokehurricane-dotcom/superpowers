#!/usr/bin/env python3
"""
Wazuh integration script: send high-severity alerts to a webhook.

Usage:
    wazuh-notify.py <alert-json-file>
    wazuh-notify.py --dry-run <alert-json-file>

Configuration (in order of precedence):
    1. Environment variable ALERT_WEBHOOK_URL
    2. Config file /var/ossec/etc/wazuh-notify.env (KEY=VALUE)
    3. Config file ./.env (KEY=VALUE)
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

DEFAULT_CONFIG = "/var/ossec/etc/wazuh-notify.env"
FALLBACK_CONFIG = "/vagrant/.env"
MITRE_CACHE_PATHS = [
    "/var/ossec/etc/data/mitre-techniques.json",
    str(Path(__file__).resolve().parent.parent / "data" / "mitre-techniques.json"),
]


def load_env(path):
    """Parse a simple KEY=VALUE env file."""
    env = {}
    if not path or not os.path.isfile(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


def find_mitre_cache():
    for path in MITRE_CACHE_PATHS:
        if os.path.isfile(path):
            return path
    return None


def load_mitre_map(path):
    if not path or not os.path.isfile(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_webhook_url():
    url = os.environ.get("ALERT_WEBHOOK_URL")
    if url:
        return url
    for cfg in (DEFAULT_CONFIG, FALLBACK_CONFIG):
        env = load_env(cfg)
        if "ALERT_WEBHOOK_URL" in env:
            return env["ALERT_WEBHOOK_URL"]
    return None


def format_payload(alert, mitre_map):
    rule = alert.get("rule", {})
    agent = alert.get("agent", {})
    mitre_ids = rule.get("mitre", {}).get("id", [])
    mitre_id = mitre_ids[0] if mitre_ids else "N/A"
    mitre_name = mitre_map.get(mitre_id, mitre_id)

    return {
        "title": f"Wazuh Alert {rule.get('id', 'N/A')} - Level {rule.get('level', 'N/A')}",
        "attack": rule.get("description", "No description"),
        "vm": agent.get("name", "unknown"),
        "mitre_tag": f"{mitre_id} - {mitre_name}",
        "level": rule.get("level"),
        "rule_id": rule.get("id"),
        "timestamp": alert.get("timestamp"),
    }


def post_webhook(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "wazuh-notify/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read().decode("utf-8", errors="ignore")


def main():
    dry_run = False
    args = sys.argv[1:]
    if "--dry-run" in args:
        dry_run = True
        args.remove("--dry-run")

    if not args:
        print("Usage: wazuh-notify.py [--dry-run] <alert-json-file>", file=sys.stderr)
        sys.exit(1)

    alert_path = args[0]
    with open(alert_path, "r", encoding="utf-8") as f:
        alert = json.load(f)

    mitre_cache_path = find_mitre_cache()
    mitre_map = load_mitre_map(mitre_cache_path)
    payload = format_payload(alert, mitre_map)

    if dry_run:
        print(json.dumps(payload, indent=2))
        sys.exit(0)

    url = get_webhook_url()
    if not url:
        print("ALERT_WEBHOOK_URL not configured; skipping notification", file=sys.stderr)
        sys.exit(0)

    try:
        status, body = post_webhook(url, payload)
        print(f"Webhook delivered: HTTP {status} - {body}")
    except urllib.error.URLError as e:
        print(f"Webhook failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
