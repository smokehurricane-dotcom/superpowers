# Password spraying detection

## Attack overview

Password spraying uses a small number of common passwords against many usernames. Unlike brute-forcing one account, it tries to avoid lockouts by spreading attempts across accounts and time.

## Verified attack command

From the Kali attack host (`10.10.0.10`):

```bash
for user in alice bob carol; do
  netexec smb 10.30.0.10 -u "$user" -p 'Winter2024!'
done
```

This produces one failed NTLM logon per user, all from the same source IP.

## Windows Security event

The detection is built on top of rule `100305` (single failed NTLM logon). Each spray attempt creates a Security event `4625`:

| Field | Value |
|-------|-------|
| Event ID | `4625` – An account failed to log on |
| Channel | Security |
| `win.eventdata.logonType` | `3` (network) |
| `win.eventdata.authenticationPackageName` | `NTLM` |
| `win.eventdata.targetUserName` | `alice`, `bob`, `carol` (different per attempt) |
| `win.eventdata.ipAddress` | `10.30.0.1` (router MASQUERADE source) |
| `win.eventdata.status` | `0xC000006D` or similar failure code |

## Wazuh rule

**Rule ID:** `100310`

```xml
<rule id="100310" level="12" frequency="3" timeframe="120">
  <if_matched_sid>100305</if_matched_sid>
  <same_field>win.eventdata.ipAddress</same_field>
  <different_field>win.eventdata.targetUserName</different_field>
  <description>Password spraying: 3 failed NTLM logons from the same IP against different users within 120 seconds</description>
  <mitre>
    <id>T1110.003</id>
  </mitre>
</rule>
```

The rule correlates three single-failure alerts (`100305`) from the same IP but against different target users within 120 seconds.

## Example alert

```json
{
  "timestamp": "2026-07-02T22:16:22.706+0000",
  "rule": {
    "level": 12,
    "description": "Password spraying: 3 failed NTLM logons from the same IP against different users within 120 seconds",
    "id": "100310",
    "mitre": { "id": ["T1110.003"], "technique": ["Password Spraying"] }
  },
  "agent": { "id": "003", "name": "dc01" },
  "decoder": { "name": "windows_eventchannel" }
}
```

## Verification

On the SIEM host, confirm rule `100310` fired:

```bash
sudo docker exec single-node_wazuh.manager_1 \
  grep -E '"id":"100310"' /var/ossec/logs/alerts/alerts.json
```

## Prevention

* Enforce account lockout policies (threshold, duration, reset counter) to slow spraying.
* Use multi-factor authentication (MFA) for all interactive accounts.
* Deploy Azure AD Password Protection or similar banned-password lists.
* Monitor for a high ratio of failed-to-successful logons across many accounts from one source.
* Implement SMB signing and restrict NTLM where possible.
