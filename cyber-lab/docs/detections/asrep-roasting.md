# AS-REP Roasting detection

## Attack overview

AS-REP roasting targets accounts that have **"Do not require Kerberos pre-authentication"** enabled. An attacker can request a TGT for such an account without knowing the password and then crack the encrypted AS-REP offline.

## Verified attack command

From the Kali attack host (`10.10.0.10`):

```bash
python3 /usr/share/doc/python3-impacket/examples/GetNPUsers.py \
  purple.lab/bob -no-pass -dc-ip 10.30.0.10
```

A successful run returns a `$krb5asrep$23$*` hash for `bob`.

## Windows Security event

| Field | Value |
|-------|-------|
| Event ID | `4768` – A Kerberos authentication ticket (TGT) was requested |
| Channel | Security |
| `win.eventdata.preAuthType` | `0` |
| `win.eventdata.status` | `0x0` |
| `win.eventdata.targetUserName` | `bob` or `bob@PURPLE.LAB` |
| `win.eventdata.serviceName` | `krbtgt` |
| `win.eventdata.ipAddress` | `::ffff:10.30.0.1` (router MASQUERADE source) |

Example decoded eventdata:

```json
{
  "targetUserName": "bob",
  "targetDomainName": "PURPLE.LAB",
  "serviceName": "krbtgt",
  "status": "0x0",
  "preAuthType": "0",
  "ipAddress": "::ffff:10.30.0.1"
}
```

## Wazuh rule

**Rule ID:** `100301`

```xml
<rule id="100301" level="12">
  <if_group>windows_security</if_group>
  <field name="win.system.eventID">^4768$</field>
  <field name="win.eventdata.status">^0x0$</field>
  <field name="win.eventdata.preAuthType">^0$</field>
  <field name="win.eventdata.targetUserName" negate="yes">^.+\$$</field>
  <description>AS-REP roasting: Kerberos TGT requested without pre-authentication for $(win.eventdata.targetUserName)</description>
  <mitre>
    <id>T1558.004</id>
  </mitre>
</rule>
```

The rule fires when a successful TGT request (status `0x0`) is made with pre-authentication type `0` for a non-computer account.

## Example alert

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

## Preventive hardening

* Do **not** disable Kerberos pre-authentication (`DONT_REQ_PREAUTH`) for any account. Re-enable pre-auth on all user accounts.
* Audit accounts with the `DONT_REQ_PREAUTH` UAC flag:

  ```powershell
  Get-ADUser -Filter 'useraccountcontrol -band 4194304' -Properties useraccountcontrol
  ```

* Enforce strong, random passwords and password rotation.
* Monitor for 4768 events with `preAuthType=0`.
* Use Azure AD / Microsoft Defender for Identity to detect anomalous authentication patterns.
