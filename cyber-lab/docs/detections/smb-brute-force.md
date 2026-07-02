# SMB authentication / brute-force detection

## Attack overview

SMB is commonly abused for credential validation, password spraying, and brute-force attacks. Tools such as `netexec` perform NTLM authentication over SMB. A successful authentication produces a Windows Security 4624 event (logon type 3, NTLM), while failed attempts produce 4625 events.

## Verified attack commands

> Replace `<LAB_ALICE_PW>` with the value you set for `LAB_ALICE_PW` in `.env`.

From the Kali attack host (`10.10.0.10`):

### Successful SMB authentication

```bash
netexec smb 10.30.0.10 -u alice -p '<LAB_ALICE_PW>'
```

### SMB brute-force (failed logons)

```bash
for i in 1 2 3 4 5; do
  netexec smb 10.30.0.10 -u alice -p "WrongPassword$i"
done
```

## Windows Security events

### Successful logon (4624)

| Field | Value |
|-------|-------|
| Event ID | `4624` – An account was successfully logged on |
| Channel | Security |
| `win.eventdata.logonType` | `3` (network) |
| `win.eventdata.authenticationPackageName` | `NTLM` |
| `win.eventdata.targetUserName` | `alice` |
| `win.eventdata.targetDomainName` | `PURPLE` |
| `win.eventdata.ipAddress` | `10.30.0.1` (router MASQUERADE source) |

### Failed logon (4625)

| Field | Value |
|-------|-------|
| Event ID | `4625` – An account failed to log on |
| Channel | Security |
| `win.eventdata.logonType` | `3` |
| `win.eventdata.authenticationPackageName` | `NTLM` |
| `win.eventdata.targetUserName` | `alice` |
| `win.eventdata.status` | `0xC000006D` or similar failure code |
| `win.eventdata.ipAddress` | `10.30.0.1` |

Example failed-logon eventdata:

```json
{
  "targetUserName": "alice",
  "targetDomainName": "purple.lab",
  "logonType": "3",
  "authenticationPackageName": "NTLM",
  "ipAddress": "10.30.0.1",
  "status": "0xC000006D"
}
```

## Wazuh rules

**Rule IDs:** `100302` (success), `100305` (single failure), `100303` (brute-force threshold)

```xml
<!-- Successful NTLM network logon from the external subnet -->
<rule id="100302" level="8">
  <if_group>windows_security</if_group>
  <field name="win.system.eventID">^4624$</field>
  <field name="win.eventdata.logonType">^3$</field>
  <field name="win.eventdata.authenticationPackageName">^NTLM$</field>
  <field name="win.eventdata.ipAddress">^10\.30\.0\.1$</field>
  <description>NTLM network logon from external subnet via router $(win.eventdata.ipAddress) for $(win.eventdata.targetDomainName)\$(win.eventdata.targetUserName)</description>
  <mitre>
    <id>T1110</id>
  </mitre>
</rule>

<!-- Single failed NTLM network logon from the external subnet -->
<rule id="100305" level="4">
  <if_group>windows_security</if_group>
  <field name="win.system.eventID">^4625$</field>
  <field name="win.eventdata.logonType">^3$</field>
  <field name="win.eventdata.authenticationPackageName">^NTLM$</field>
  <field name="win.eventdata.ipAddress">^10\.30\.0\.1$</field>
  <description>Failed NTLM network logon from external subnet via router $(win.eventdata.ipAddress) for $(win.eventdata.targetUserName)</description>
  <mitre>
    <id>T1110</id>
  </mitre>
</rule>

<!-- Brute-force threshold: 5 failed NTLM logons from the same IP within 60 seconds -->
<rule id="100303" level="12" frequency="5" timeframe="60">
  <if_matched_sid>100305</if_matched_sid>
  <same_field>win.eventdata.ipAddress</same_field>
  <description>SMB brute-force: 5 failed NTLM logons from the same IP within 60 seconds</description>
  <mitre>
    <id>T1110.001</id>
  </mitre>
</rule>
```

The IP filter is set to `10.30.0.1` because the lab router performs MASQUERADE for traffic crossing from Lab-Internal (`10.10.0.0/24`) into ADNet (`10.30.0.0/24`).

## Example alerts

### Successful SMB auth (100302)

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

### Brute-force threshold (100303)

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

## Verification

On the SIEM host, confirm rules `100302`, `100303`, and/or `100305` fired:

```bash
sudo docker exec single-node_wazuh.manager_1 \
  grep -E '"id":"10030[2-5]"' /var/ossec/logs/alerts/alerts.json
```

## Prevention

* Raise the LAN Manager authentication level to **"Send NTLMv2 response only. Refuse LM & NTLM"** where feasible.
* Enforce **SMB signing** on all domain members to prevent relay attacks.
* Configure NTLM auditing and restrict NTLM outbound via Group Policy:
  * `Network security: Restrict NTLM: Outgoing NTLM traffic to remote servers`
  * `Network security: Restrict NTLM: Audit outgoing NTLM traffic to remote servers`
* Implement account lockout policies (threshold, duration, reset counter) to slow brute-force.
* Use Local Administrator Password Solution (LAPS) and strong, unique local admin passwords.
* Disable SMBv1 and block TCP 445 at the perimeter where SMB is not required.
* Require Extended Protection for Authentication (EPA) for LDAP/SMB and channel binding for LDAP signing.
