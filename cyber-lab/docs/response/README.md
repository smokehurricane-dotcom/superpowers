# Phase 5C — Alerting integration and Active Response

This page documents the final Phase 5C work: a custom Wazuh webhook integration and a staged (but not yet wired) Windows firewall-block Active Response.

## Goal

1. Send every high-severity Wazuh alert to an external webhook with MITRE technique enrichment.
2. Provide a PowerShell Active Response script that can temporarily block an attacker IP on the DC.

## Files added / changed

| File | Purpose |
|------|---------|
| `scripts/wazuh-notify.py` | Custom Wazuh integration: reads the alert file, enriches MITRE IDs, POSTs JSON to `ALERT_WEBHOOK_URL`. |
| `scripts/custom-wazuh-notify` | Shell wrapper required by Wazuh 4.x custom integrations; integration name in `ossec.conf` must be `custom-wazuh-notify`. |
| `data/mitre-techniques.json` | Local cache of MITRE ATT&CK technique names built from the public STIX dump. |
| `scripts/webhook-receiver.py` | Tiny test receiver used on Kali to capture delivery attempts. |
| `scripts/active-response/firewall-block.ps1` | Staged PowerShell AR script for the DC. |
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
/var/ossec/logs/alerts/alerts.json contains 1 alert for rule 100303
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

## Active Response — deferred wiring

### What is staged

- `scripts/active-response/firewall-block.ps1` was uploaded to the DC at `C:\wazuh-ar\firewall-block.ps1`.
- The script reads Wazuh AR JSON from stdin, extracts the attacker IP, creates a temporary Windows Firewall block rule, waits 600 seconds, then removes it.

### Why it is not wired yet

Adding the required `<command>` and `<active-response>` blocks to `ossec.conf` repeatedly corrupted the file in earlier attempts because Windows paths with backslashes and quotes were mangled by the remote shell/Python escaping layers.  After the corruption the manager failed to start (`wazuh-db did not start correctly`).  Rather than risk breaking the working webhook integration on the final pass, the AR wiring is intentionally deferred.

### Remaining work to enable AR

1. Copy `firewall-block.ps1` into the Wazuh agent's `active-response\bin\` directory on the DC (custom AR scripts must live there).
2. Add a `<command>` block to the manager's `ossec.conf`, e.g.:

   ```xml
   <command>
     <name>firewall-block</name>
     <executable>firewall-block.ps1</executable>
     <timeout_allowed>yes</timeout_allowed>
   </command>
   ```

3. Add an `<active-response>` block that references the command and the relevant rule group/ID, e.g.:

   ```xml
   <active-response>
     <command>firewall-block</command>
     <location>local</location>
     <rules_id>100303,100306,100310</rules_id>
     <timeout>600</timeout>
   </active-response>
   ```

4. Restart the Wazuh manager and verify `active-responses.log` on the DC.

Status: **AR script is staged; manager-side command/AR block is NOT configured.**

## Known issues

- `win10-1` agent occasionally shows as `Disconnected` in the Wazuh dashboard.  This is a pre-existing intermittent issue from Phase 4 and does not affect the webhook integration.

## Snapshot recommendation

If you want to preserve this state, snapshot all VMs now:

```bash
for vm in router siem kali target dc win10; do
  vagrant snapshot save "$vm" clean-phase5c
done
```

To roll back to the pre-5C baseline, use `clean-phase5b`.
