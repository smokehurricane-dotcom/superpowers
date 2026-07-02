# Golden Ticket indicators

## Attack overview

A Golden Ticket is a forged Kerberos Ticket-Granting-Ticket (TGT) encrypted with the `krbtgt` account hash. An attacker who compromises the `krbtgt` hash can create TGTs for any user, bypassing the KDC. When the forged TGT is used to request service tickets (4769), it often exhibits distinctive ticket option flags, notably `0x40810000`.

## Attack command (reference)

A real Golden Ticket is typically created with Mimikatz or Rubeus inside a compromised domain. A representative lab command using Mimikatz:

```text
mimikatz # kerberos::golden /user:administrator /domain:purple.lab /sid:S-1-5-21-... \
  /krbtgt:<krbtgt_ntlm_hash> /ptt
```

Because this lab does not include a real Golden Ticket attack, the rule below is validated syntactically and documented as a detection heuristic.

## Windows Security event

| Field | Value |
|-------|-------|
| Event ID | `4769` – A Kerberos service ticket was requested |
| Channel | Security |
| `win.eventdata.ticketOptions` | `0x40810000` (Forwardable, Renewable, Canonicalize unset) |
| `win.eventdata.ipAddress` | Source of the TGS request (external IP or `::ffff:10.30.0.1` in this lab) |
| `win.eventdata.serviceName` | Non-computer service account (e.g. `svc_sql`) |
| `win.eventdata.targetUserName` | User named in the forged TGT |

Windows Security events 4768/4769 do **not** include explicit ticket lifetime fields, so this rule relies on the known suspicious ticket option pattern combined with an external source IP and a non-computer target service.

## Wazuh rule

**Rule ID:** `100320`

```xml
<rule id="100320" level="10">
  <if_group>windows_security</if_group>
  <field name="win.system.eventID">^4769$</field>
  <field name="win.eventdata.ticketOptions">^0x40810000$</field>
  <field name="win.eventdata.ipAddress">10\.30\.0\.1</field>
  <field name="win.eventdata.serviceName" negate="yes">^.+\$$</field>
  <description>Golden Ticket indicator: TGS request with suspicious ticket options $(win.eventdata.ticketOptions) for $(win.eventdata.serviceName) by $(win.eventdata.targetUserName)</description>
  <mitre>
    <id>T1558.001</id>
  </mitre>
</rule>
```

The rule flags a 4769 event with the `0x40810000` option flag coming from the external lab segment and targeting a non-computer service account.

## Example alert (expected format)

> This alert format was constructed syntactically; no live Golden Ticket was generated in the lab.

```json
{
  "timestamp": "2026-07-02T22:20:00.000+0000",
  "rule": {
    "level": 10,
    "description": "Golden Ticket indicator: TGS request with suspicious ticket options 0x40810000 for svc_sql by administrator@PURPLE.LAB",
    "id": "100320",
    "mitre": { "id": ["T1558.001"], "technique": ["Golden Ticket"] }
  },
  "agent": { "id": "003", "name": "dc01" },
  "decoder": { "name": "windows_eventchannel" }
}
```

## Verification

Because no real Golden Ticket was created, the rule is validated by confirming that Wazuh loads it without errors:

```bash
# On the SIEM VM
sudo docker exec single-node_wazuh.manager_1 /var/ossec/bin/wazuh-control restart
sudo docker exec single-node_wazuh.manager_1 grep -E '100320' /var/ossec/logs/alerts/alerts.json
```

In a production environment, verify by generating a Golden Ticket with a red-team tool and requesting a service ticket from a non-DC host.

## Prevention

* Rotate the `krbtgt` account password twice to invalidate existing Golden Tickets (do this with caution and during a maintenance window).
* Protect Domain Admin and `krbtgt` credentials with privileged access workstations (PAW) and credential guard.
* Monitor for anomalous 4768/4769 events, especially ticket option `0x40810000` from non-DC sources.
* Deploy Microsoft Defender for Identity to detect anomalous Kerberos ticket usage.
