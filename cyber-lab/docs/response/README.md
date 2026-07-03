# Phase 5C — Alerting integration and Active Response

This page documents the final Phase 5C work: a custom Wazuh webhook integration and a Windows firewall-block Active Response.

## Goal

1. Send every high-severity Wazuh alert to an external webhook with MITRE technique enrichment.
2. Temporarily block an attacker IP on the DC when an SMB brute-force attack is detected.

## Files added / changed

| File | Purpose |
|------|---------|
| `scripts/wazuh-notify.py` | Custom Wazuh integration: reads the alert file, enriches MITRE IDs, POSTs JSON to `ALERT_WEBHOOK_URL`. |
| `scripts/custom-wazuh-notify` | Shell wrapper required by Wazuh 4.x custom integrations; integration name in `ossec.conf` must be `custom-wazuh-notify`. |
| `data/mitre-techniques.json` | Local cache of MITRE ATT&CK technique names built from the public STIX dump. |
| `scripts/webhook-receiver.py` | Tiny test receiver used on Kali to capture delivery attempts. |
| `scripts/active-response/firewall-block.ps1` | PowerShell AR script for the DC. |
| `scripts/active-response/firewall-block.cmd` | CMD launcher that Wazuh `execd` calls on the DC. |
| `scripts/active-response/ossec-ar-snippet.xml` | `<command>` + `<active-response>` block for the manager's `ossec.conf`. |
| `scripts/patch-ossec-conf.py` | Idempotent host-side `ossec.conf` patcher (removes old `firewall-block` blocks, inserts a fresh one, validates XML). |
| `.env.example` | Added `ALERT_WEBHOOK_URL` placeholder. |
| `.gitignore` | Excludes the raw `enterprise-attack.json` STIX source. |

## Webhook integration

### Manager-side configuration

The following block was added to `/var/ossec/etc/ossec.conf` inside the Wazuh manager container:

```xml
<integration>
  <name>custom-wazuh-notify</name>
  <level>10</level>
  <alert_format>json</alert_format>
</integration>
```

Key points:

- Wazuh 4.10 only allows built-in integration names (`slack`, `pagerduty`, etc.) or names starting with `custom-`.  The integration name must therefore be `custom-wazuh-notify`, and the executable must exist as `/var/ossec/integrations/custom-wazuh-notify`.
- The wrapper calls `scripts/wazuh-notify.py`, which expects an alert file path as its argument (Wazuh `integratord` supplies this automatically).
- `ALERT_WEBHOOK_URL` is read from environment / `/var/ossec/etc/wazuh-notify.env` / `/vagrant/.env`.
- The MITRE cache is loaded from `/var/ossec/etc/data/mitre-techniques.json` (or the repo `data/` path as a fallback).

### Installation summary

On a fresh build, the SIEM provisioner (or a manual run) needs to:

```bash
# From the repo root on the SIEM host
sudo docker cp scripts/custom-wazuh-notify      single-node_wazuh.manager_1:/var/ossec/integrations/custom-wazuh-notify
sudo docker cp scripts/wazuh-notify.py          single-node_wazuh.manager_1:/var/ossec/integrations/wazuh-notify.py
sudo docker cp data/mitre-techniques.json       single-node_wazuh.manager_1:/var/ossec/etc/data/mitre-techniques.json
sudo docker exec single-node_wazuh.manager_1 chmod +x /var/ossec/integrations/custom-wazuh-notify

# Set the webhook destination
sudo docker exec single-node_wazuh.manager_1 bash -c \
  'echo "ALERT_WEBHOOK_URL=<KALI_RECEIVER_URL>" > /var/ossec/etc/wazuh-notify.env'

# Add the <integration> block to /var/ossec/etc/ossec.conf, then restart
sudo docker exec single-node_wazuh.manager_1 /var/ossec/bin/wazuh-control restart
```

### Verification

An SMB brute-force attack from Kali against the DC triggered rule `100303` (level 12).  The integration delivered the alert to the webhook receiver running on Kali (`<KALI_RECEIVER_URL>`).

Attack command:

```bash
for i in $(seq 1 6); do
  netexec smb 10.30.0.10 -u alice -p "WrongPassword$i"
done
```

Result on the SIEM:

```text
/var/ossec/logs/alerts/alerts.json contains alerts for rule 100303
```

Webhook payload captured on Kali (`/tmp/wazuh-webhook.log`):

```json
{
  "path": "/webhook",
  "body": {
    "title": "Wazuh Alert 100303 - Level 12",
    "attack": "SMB brute-force: 5 failed NTLM logons from the same IP within 60 seconds",
    "vm": "dc01",
    "mitre_tag": "T1110.001 - Password Guessing",
    "level": 12,
    "rule_id": "100303",
    "timestamp": "2026-07-03T00:09:16.553+0000"
  }
}
```

Status: **webhook integration is configured and end-to-end verified.**

## Active Response — blocked

### What is wired

- `scripts/active-response/firewall-block.ps1` and `scripts/active-response/firewall-block.cmd` are deployed to `C:\Program Files (x86)\ossec-agent\active-response\bin\` on the DC.
- The manager's `/var/ossec/etc/ossec.conf` contains a valid `<command>` and `<active-response>` block for `firewall-block`, inserted via the file-bytes method (host file → base64 → `docker cp` → decode).
- Windows Firewall is enabled on the DC with explicit allow rules for WinRM inbound and Wazuh agent outbound to the manager (`10.10.0.30:1514`).
- The PowerShell script is hardened so it never blocks the manager (`10.10.0.30`) or the router (`10.30.0.2`).

Manager-side AR config:

```xml
<command>
  <name>firewall-block</name>
  <executable>firewall-block.cmd</executable>
  <timeout_allowed>yes</timeout_allowed>
</command>

<active-response>
  <disabled>no</disabled>
  <command>firewall-block</command>
  <location>local</location>
  <level>10</level>
  <timeout>600</timeout>
</active-response>
```

### Local script verification

Feeding the script valid Wazuh AR JSON creates inbound and outbound block rules and logs the action:

```text
Name                          DisplayName                   Direction Action Enabled
----                          -----------                   --------- ------ -------
WAZUH-AR-BLOCK-10-30-0-99     WAZUH-AR-BLOCK-10-30-0-99       Inbound  Block    True
WAZUH-AR-BLOCK-10-30-0-99-out WAZUH-AR-BLOCK-10-30-0-99-out  Outbound  Block    True

2026-07-03T12:27:25.7918156+00:00 Blocking 10.30.0.99
2026-07-03T12:28:25.8161534+00:00 Unblocking 10.30.0.99
```

### Why it is not verified end-to-end

1. **Wazuh manager instability:** the manager process inside the SIEM container restarts every few minutes. Each restart truncates `alerts/alerts.json` and drops agent connections.
2. **DC agent instability:** the Wazuh service on the DC stops/starts repeatedly. After a restart it sometimes logs `Could not EvtSubscribe() for (Security) which returned (15001)`, preventing Security events from reaching the manager.
3. **No automatic AR invocation:** when rule `100303` fires, neither the manager's `active-responses.log` nor the DC's `active-response\active-responses.log` shows a `firewall-block` entry.
4. **Manual invocation not executed:** `agent_control -b 10.30.0.1 -f firewall-block60 -u 001` is accepted by the manager, but the DC agent does not create the firewall rule or log anything.

Status: **AR script and manager config are wired, but the end-to-end trigger → block → timeout loop is blocked by Wazuh manager/agent instability.**

## Known issues

- `win10-1` agent occasionally shows as `Disconnected` in the Wazuh dashboard. This is a pre-existing intermittent issue from Phase 4.
- After a fresh `vagrant up siem`, the SIEM host is missing persistent routes to `10.20.0.0/24` and `10.30.0.0/24` via `10.10.0.2`. This breaks DC → manager connectivity until the routes are re-added.

## Snapshot recommendation

If you want to preserve this state, snapshot all VMs now:

```bash
for vm in router siem kali target dc win10; do
  vagrant snapshot save "$vm" clean-phase5c-ar-wired
  # use --force to overwrite an existing snapshot
done
```

To roll back to the pre-AR baseline, use `clean-5c-pre-ar`.
