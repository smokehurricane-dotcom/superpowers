# Active Directory Attack Detections

This directory contains Wazuh detection rules and playbooks for the verified AD attack paths built in Phase 3/5B.

## Custom rule file

All detection rules live in `wazuh-rules/custom_ad_rules.xml`. During SIEM provisioning the file is copied into the Wazuh manager container as `/var/ossec/ruleset/rules/0599-custom_ad_rules.xml` so the rules load **after** the built-in Windows Security rules. This avoids the `if_sid` chaining issue that can prevent custom eventchannel rules from firing in Wazuh 4.10; the rules use `<if_group>windows_security</if_group>` instead.

| Rule ID | Technique | Description | Level | Status |
|---------|-----------|-------------|-------|--------|
| [100300](kerberoasting.md) | Kerberoasting (T1558.003) | Weakly encrypted (RC4/DES) Kerberos service ticket requested for a non-computer account | 12 | ✅ Verified |
| [100301](asrep-roasting.md) | AS-REP Roasting (T1558.004) | Kerberos TGT requested without pre-authentication | 12 | ✅ Verified |
| [100302](smb-brute-force.md) | Valid NTLM logon (T1110) | NTLM network logon (type 3) from the lab router / external subnet | 8 | ✅ Verified |
| [100305](smb-brute-force.md) | Failed NTLM logon (T1110) | Single failed NTLM network logon from the lab router / external subnet | 4 | ✅ Verified |
| [100303](smb-brute-force.md) | SMB brute-force (T1110.001) | 5 failed NTLM logons from the same IP within 60 seconds | 12 | ✅ Verified |
| [100306](dcsync.md) | DCSync (T1003.006) | Directory replication access requested with DS-Replication-Get-Changes GUIDs | 14 | ✅ Verified |
| [100310](password-spraying.md) | Password spraying (T1110.003) | 3 failed NTLM logons from the same IP against different users within 120 seconds | 12 | ✅ Verified |
| [100320](golden-ticket.md) | Golden Ticket (T1558.001) | TGS request with suspicious ticket options from the external subnet | 10 | 📝 Syntactic rule / not live-tested |

## Quick verification

From the Kali attack host (`10.10.0.10`) run the attack commands documented in each playbook, then check the Wazuh manager:

```bash
# On the SIEM VM
sudo docker exec single-node_wazuh.manager_1 grep -E '"id":"1003[0-2][0-9]"' /var/ossec/logs/alerts/alerts.json
```

Alerts should appear within a few seconds of the attack traffic reaching the DC.

## Notes

* The DC sees cross-subnet traffic as coming from the router's ADNet interface (`10.30.0.1`) because the router performs MASQUERADE for inter-segment traffic. The SMB/NTLM rules therefore filter on `10.30.0.1`, not the Kali host's own `10.10.0.10` address.
* `logall_json` was enabled during rule development so that decoded Security events could be inspected in `/var/ossec/logs/archives/archives.json` even when they did not generate an alert.
