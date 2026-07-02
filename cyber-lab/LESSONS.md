# Lab Lessons Learned

This file collects operational lessons from building the purple-team lab.  
Each lesson is tagged with the phase where it was learned.

## Phase 2

### Wazuh manager/agent version coupling
The Wazuh Docker manager image tag (pinned to `4.10.1`) must match the `wazuh-agent` package version installed on every endpoint.  
**Fix:** always install `wazuh-agent=4.10.1-1` with `DEBIAN_FRONTEND=noninteractive` and pin the Docker branch/tag.

### Docker container name collisions on re-provision
Re-running a provisioner that starts a container can fail if the old container still exists.  
**Fix:** `docker rm -f <name> || true` before `docker run`.

## Phase 3

### Windows Vagrant boxes need plaintext WinRM + basic auth
The gusztavvargadr and StefanScherer boxes used in this lab connect reliably only when Vagrant is forced to plaintext WinRM with basic authentication.

```ruby
config.vm.communicator = "winrm"
config.winrm.transport = :plaintext
config.winrm.basic_auth_only = true
config.winrm.username = "vagrant"
config.winrm.password = "vagrant"
```

### Windows Server AD promotion is silent and slow
`Install-ADDSForest` can run for 10–20 minutes with no console output.  
**Fix:** wrap the script in `Start-Transcript` / `Stop-Transcript` and/or redirect `Install-ADDSForest` output to a log file so progress is visible.

### AD promotion warning about non-static adapters is benign
`Install-ADDSForest` warns that a network adapter lacks a static IP. The NAT adapter (`10.0.2.0/24`) is DHCP by design; only the ADNet adapter needs a static IP. The warning can be ignored.

### Windows cross-subnet routing
The lab uses the router VM (`10.30.0.2`) as the gateway for traffic from ADNet to Lab-Internal and TargetNet.

- PowerShell idiom: `New-NetRoute -DestinationPrefix "10.10.0.0/24" -NextHop "10.30.0.2" -InterfaceAlias $ifAlias`
- `route -p add 10.10.0.0 mask 255.255.255.0 10.30.0.2` also works but prints noisy help text when run from PowerShell.

### Domain-joined Windows 10 client may break its secure channel
After the first domain-join reboot, the evaluation Windows 10 box sometimes reports:

```
The trust relationship between this workstation and the primary domain failed.
```

**Fix:** run `Test-ComputerSecureChannel -Repair -Server dc01.purple.lab -Credential <domain-admin>` before starting services that query AD. This is now part of `scripts/provision-win10-step2.ps1`.

### BloodHound on Kali needs DNS help
The Kali VM is on Lab-Internal and does not use the DC as its DNS server. `bloodhound.py` is installed as `bloodhound-python` and fails to resolve `dc01.purple.lab` without help.

**Fixes:**

1. Add the DC to `/etc/hosts`:
   ```bash
   echo '10.30.0.10 dc01.purple.lab' | sudo tee -a /etc/hosts
   ```
2. Or use the `-ns` flag:
   ```bash
   bloodhound-python -d purple.lab -u alice -p 'Password123!' \
     -ns 10.30.0.10 -dc dc01.purple.lab -c All --zip
   ```

### Use `vagrant-reload` for Windows reboots
Vagrant has no built-in reboot provisioner. The `vagrant-reload` plugin is required so Windows VMs can reboot mid-provision (after AD promotion, after domain join, etc.).

```bash
vagrant plugin install vagrant-reload
```

### Snapshot naming convention
Use `clean-phase<N>` for the known-good snapshot after each phase.  
Phase 3 restore: `vagrant snapshot restore <vm> clean-phase3`.

## Phase 4

### Custom Wazuh rules for Windows EventChannel must load after built-in Security rules
Placing custom rules in `/var/ossec/etc/rules/` caused rule IDs to load before the built-in `0580-win-security_rules.xml` parent rules. The resulting `if_sid` chain did not evaluate, so no alerts fired for the AD attack paths.

**Fix:** copy `custom_ad_rules.xml` into `/var/ossec/ruleset/rules/` with a filename that sorts after the built-in rules (e.g. `0599-custom_ad_rules.xml`) and use `<if_group>windows_security</if_group>` instead of `<if_sid>`. This is now done by the SIEM provisioner in the `Vagrantfile`.

### `<if_group>` matches file-level groups, not inline rule groups
`if_group` only matches the `<group>` container declared at the top of a rules file. Inline `<group>` tags inside individual rules (e.g. `authentication_success`, `authentication_failed`) are not matched by `if_group`. For AD Security events, the usable file-level group is `windows_security` from `0580-win-security_rules.xml`.

### Inter-segment traffic is NATed by the router
Because the router MASQUERADES cross-subnet traffic, the DC sees connections from the Kali attack host (`10.10.0.10`) as originating from `10.30.0.1`. SMB/NTLM detection rules must filter on `10.30.0.1`, not `10.10.0.10`.

### Wazuh `wazuh-logtest` cannot directly test EventChannel events
`wazuh-logtest` decodes pasted JSON as `json`, not `windows_eventchannel`. To unit-test rules locally:

1. Temporarily change rule `60000` in `0575-win-base_rules.xml` from `<decoded_as>windows_eventchannel</decoded_as>` to `<decoded_as>json</decoded_as>` and remove `<category>ossec</category>`.
2. Feed the JSON `full_log` from an alert or archive.
3. Revert the base rule before running the manager in production.

Alternatively, verify rules by running the real attack and grepping `/var/ossec/logs/alerts/alerts.json`.

### Use `archives.json` to inspect decoded events that do not alert
Enabling `<logall_json>yes</logall_json>` in `/var/ossec/etc/ossec.conf` writes every decoded event to `/var/ossec/logs/archives/archives.json`. This is invaluable for confirming that events reached the manager and for checking exact field names/values before writing rules.
