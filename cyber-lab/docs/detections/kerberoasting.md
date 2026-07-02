# Kerberoasting detection

## Attack overview

Kerberoasting requests service tickets for user accounts that have Service Principal Names (SPNs). If the ticket uses a weak encryption type such as RC4 (etype 23 / `0x17`), the ticket hash can be cracked offline to recover the service account password.

## Verified attack command

From the Kali attack host (`10.10.0.10`):

```bash
python3 /usr/share/doc/python3-impacket/examples/GetUserSPNs.py \
  purple.lab/alice:Password123! -dc-ip 10.30.0.10 -request
```

A successful run returns a `$krb5tgs$23$*` hash for the `svc_sql` account.

## Windows Security event

| Field | Value |
|-------|-------|
| Event ID | `4769` – A Kerberos service ticket was requested |
| Channel | Security |
| `win.eventdata.serviceName` | `svc_sql` (or any non-computer user account with an SPN) |
| `win.eventdata.ticketEncryptionType` | `0x17` (RC4), `0x11` (AES-128-CTS-HMAC-SHA1-96 older mapping), `0x3` or `0x1` |
| `win.eventdata.targetUserName` | `alice@PURPLE.LAB` |
| `win.eventdata.status` | `0x0` |
| `win.eventdata.ipAddress` | `::ffff:10.30.0.1` (router MASQUERADE source) |

Example decoded eventdata (from `/var/ossec/logs/archives/archives.json`):

```json
{
  "targetUserName": "alice@PURPLE.LAB",
  "targetDomainName": "PURPLE.LAB",
  "serviceName": "svc_sql",
  "ticketEncryptionType": "0x17",
  "ipAddress": "::ffff:10.30.0.1",
  "status": "0x0"
}
```

## Wazuh rule

**Rule ID:** `100300`

```xml
<rule id="100300" level="12">
  <if_group>windows_security</if_group>
  <field name="win.system.eventID">^4769$</field>
  <field name="win.eventdata.ticketEncryptionType">^0x1$|^0x3$|^0x11$|^0x17$</field>
  <field name="win.eventdata.serviceName" negate="yes">^.+\$$</field>
  <description>Kerberoasting: weakly encrypted service ticket requested for user account $(win.eventdata.serviceName) by $(win.eventdata.targetUserName)</description>
  <mitre>
    <id>T1558.003</id>
  </mitre>
</rule>
```

The rule fires when a 4769 event for a non-computer account uses a weak ticket encryption type.

## Example alert

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

## Preventive hardening

* Set service accounts to support only AES encryption:
  * Open **Active Directory Users and Computers** → account properties → **Account** tab → check **"This account supports Kerberos AES 128 bit encryption"** and **"AES 256 bit encryption"** and clear any RC4/DES options.
* Use long, randomly generated service account passwords and rotate them regularly.
* Remove unnecessary SPNs; avoid assigning SPNs to user accounts when a gMSA or sMSA can be used instead.
* Enable **Audit Kerberos Service Ticket Operations** (4769) on domain controllers.
* Consider Microsoft Defender for Identity / Azure AD Password Protection and attack surface reduction rules.
