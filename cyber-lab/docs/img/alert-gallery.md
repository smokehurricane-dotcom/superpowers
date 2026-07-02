# Alert gallery

These JSON extracts are from `/var/ossec/logs/alerts/alerts.json` on the Wazuh manager after running the Phase 4 attack set from Kali.

## Phase 4 alert counts

| Rule ID | Description | Count |
|---------|-------------|-------|
| 100300 | Kerberoasting | 3 |
| 100301 | AS-REP roasting | 6 |
| 100302 | NTLM SMB success | 17 |
| 100303 | SMB brute-force threshold | 2 |
| 100305 | NTLM SMB failure | 8 |

## 100300 — Kerberoasting

```json
{
  "timestamp": "2026-07-02T18:37:23.889+0000",
  "rule": {
    "level": 12,
    "description": "Kerberoasting: weakly encrypted service ticket requested for user account svc_sql by alice@PURPLE.LAB",
    "id": "100300",
    "mitre": { "id": ["T1558.003"], "technique": ["Kerberoasting"] }
  },
  "agent": { "id": "003", "name": "dc01" },
  "decoder": { "name": "windows_eventchannel" }
}
```

## 100301 — AS-REP roasting

```json
{
  "timestamp": "2026-07-02T18:19:14.994+0000",
  "rule": {
    "level": 12,
    "description": "AS-REP roasting: Kerberos TGT requested without pre-authentication for bob",
    "id": "100301",
    "mitre": { "id": ["T1558.004"], "technique": ["AS-REP Roasting"] }
  },
  "agent": { "id": "003", "name": "dc01" },
  "decoder": { "name": "windows_eventchannel" }
}
```

## 100302 — NTLM SMB success

```json
{
  "timestamp": "2026-07-02T18:27:33.889+0000",
  "rule": {
    "level": 8,
    "description": "NTLM network logon from external subnet via router 10.30.0.1 for PURPLE\\alice",
    "id": "100302",
    "mitre": { "id": ["T1110"], "technique": ["Brute Force"] }
  },
  "agent": { "id": "003", "name": "dc01" }
}
```

## 100303 — SMB brute-force threshold

```json
{
  "timestamp": "2026-07-02T18:27:56.125+0000",
  "rule": {
    "level": 12,
    "description": "SMB brute-force: 5 failed NTLM logons from the same IP within 60 seconds",
    "id": "100303",
    "mitre": { "id": ["T1110.001"], "technique": ["Password Guessing"] }
  },
  "agent": { "id": "003", "name": "dc01" }
}
```

## 100305 — NTLM SMB failure

```json
{
  "timestamp": "2026-07-02T18:27:55.889+0000",
  "rule": {
    "level": 4,
    "description": "Failed NTLM network logon from external subnet via router 10.30.0.1 for alice",
    "id": "100305",
    "mitre": { "id": ["T1110"], "technique": ["Brute Force"] }
  },
  "agent": { "id": "003", "name": "dc01" }
}
```

## Verification command

```bash
sudo docker exec single-node_wazuh.manager_1 \
  grep -E '"id":"10030[0-5]"' /var/ossec/logs/alerts/alerts.json
```
