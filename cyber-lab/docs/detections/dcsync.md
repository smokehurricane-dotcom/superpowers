# DCSync detection

## Attack overview

DCSync abuses the Directory Replication Service (DRS) protocol to request password hashes from a domain controller. An attacker with Domain Admin rights (or the Replicating Directory Changes extended rights) can pull the entire NTDS database remotely without touching disk.

## Verified attack command

From the Kali attack host (`10.10.0.10`):

```bash
python3 /usr/share/doc/python3-impacket/examples/secretsdump.py \
  'purple.lab/alice:<LAB_ALICE_PW>@10.30.0.10' -just-dc
```

> Replace `<LAB_ALICE_PW>` with the value you set for `LAB_ALICE_PW` in `.env`.

A successful run dumps domain account hashes via the DRSUAPI method.

## Windows Security event

| Field | Value |
|-------|-------|
| Event ID | `4662` – An operation was performed on an object |
| Channel | Security |
| `win.eventdata.objectServer` | `DS` |
| `win.eventdata.accessMask` | `0x100` (Control Access) |
| `win.eventdata.properties` | Contains one or both replication GUIDs: `{1131f6aa-9c07-11d1-f79f-00c04fc2dcd2}` (DS-Replication-Get-Changes) or `{1131f6ad-9c07-11d1-f79f-00c04fc2dcd2}` (DS-Replication-Get-Changes-All) |
| `win.eventdata.subjectUserName` | Account performing the replication (e.g. `alice`) |

Example decoded eventdata:

```json
{
  "subjectUserName": "alice",
  "subjectDomainName": "PURPLE",
  "objectServer": "DS",
  "objectType": "%{19195a5b-6da0-11d0-afd3-00c04fd930c9}",
  "accessMask": "0x100",
  "properties": "%%7688    {1131f6ad-9c07-11d1-f79f-00c04fc2dcd2}   {19195a5b-6da0-11d0-afd3-00c04fd930c9}"
}
```

## Wazuh rule

**Rule ID:** `100306`

```xml
<rule id="100306" level="14">
  <if_group>windows_security</if_group>
  <field name="win.system.eventID">^4662$</field>
  <field name="win.eventdata.objectServer">^DS$</field>
  <field name="win.eventdata.accessMask">^0x100$</field>
  <field name="win.eventdata.properties">1131f6aa|1131f6ad</field>
  <description>DCSync: directory replication access requested by $(win.eventdata.subjectDomainName)\$(win.eventdata.subjectUserName)</description>
  <mitre>
    <id>T1003.006</id>
  </mitre>
</rule>
```

The rule fires when an account requests Control Access against the directory service with a replication GUID.

## Example alert

```json
{
  "timestamp": "2026-07-02T22:08:45.284+0000",
  "rule": {
    "level": 14,
    "description": "DCSync: directory replication access requested by PURPLE\\alice",
    "id": "100306",
    "mitre": { "id": ["T1003.006"], "technique": ["DCSync"] }
  },
  "agent": { "id": "003", "name": "dc01" },
  "decoder": { "name": "windows_eventchannel" }
}
```

## Verification

On the SIEM host, confirm rule `100306` fired:

```bash
sudo docker exec single-node_wazuh.manager_1 \
  grep -E '"id":"100306"' /var/ossec/logs/alerts/alerts.json
```

## Prevention

* Strictly limit accounts holding **Replicating Directory Changes** / **Replicating Directory Changes All** rights.
* Monitor membership of the **Domain Admins**, **Enterprise Admins**, and **Administrators** groups.
* Enable **Audit Directory Service Access** (4662) on domain controllers.
* Consider Microsoft Defender for Identity / Azure AD Password Protection and privileged access workstations (PAW).
* Segment access to domain controllers and disable unnecessary replication paths.
