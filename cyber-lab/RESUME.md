# Slice 1 Resume Point — before host reboot

Date: 2026-07-03
Status: SIEM-side Active Response config applied and manager restarted cleanly; DC-side blocked by a Vagrant machine lock. Host reboot required before continuing.

## Root cause: clean-phase5c snapshot is contaminated

The SIEM snapshot `clean-phase5c` is **not clean**:

- `/var/ossec/etc/ossec.conf` inside the Wazuh manager container was modified at `2026-07-02 23:58:08`.
- That config contains a leftover `<command>` / `<active-response>` firewall-block pair from the earlier Phase 5C escaping/corruption attempts.
- The snapshot was saved at `02:43` the next day, so it froze the corrupted config.
- **Rule:** do not trust a snapshot name — verify the config against the provisioned template before declaring it clean.

## Current SIEM state

- The running manager has a **manually patched** `ossec.conf`:
  - Old firewall-block blocks removed.
  - One clean block inserted:
    ```xml
    <command>
      <name>firewall-block</name>
      <executable>firewall-block.cmd</executable>
      <timeout_allowed>yes</timeout_allowed>
    </command>
    <active-response>
      <command>firewall-block</command>
      <location>local</location>
      <level>10</level>
      <timeout>600</timeout>
    </active-response>
    ```
- Manager restart completed successfully; all important daemons are running.
- This config is live in the container only and will be lost on `vagrant destroy siem` until it is folded into provisioning.

## After reboot — regenerate, do not restore

1. **Do not restore `clean-phase5c` for the SIEM** — it will re-introduce the corrupted config.
2. Regenerate a clean config from version control / provisioning:
   - `vagrant destroy siem && vagrant up siem`, or
   - re-run the SIEM provisioner from the `Vagrantfile`.
3. Apply the AR patch once with `scripts/patch-ossec-conf.py` (idempotent — removes existing firewall-block blocks before inserting).

## Slice 1 remaining steps after reboot

- [ ] Verify manager restarts cleanly with the AR patch on a regenerated config.
- [ ] Copy `firewall-block.ps1` and `firewall-block.cmd` to the DC's `C:\Program Files (x86)\ossec-agent\active-response\bin\`.
- [ ] Enable Windows Firewall on the DC with explicit allow rules for WinRM and the Wazuh manager.
- [ ] Harden `firewall-block.ps1` to never block the SIEM/manager (`10.10.0.30`) and the router (`10.30.0.2`).
- [ ] Live test: SMB brute-force from Kali → rule `100303` → AR block → timeout → rule removed.
- [ ] Update `docs/response/README.md`, `README.md`, and `ROADMAP.md` from "deferred" to "verified".

## Open decision after reboot

- **Path A (approved plan):** Use the new `firewall-block.cmd` block + script in `active-response\bin\`.
- **Path B:** Keep the existing `powershell.exe -File C:\wazuh-ar\firewall-block.ps1` block from the contaminated snapshot and only fix that script (fewer DC changes).

Decide after reboot.

## Files already in the repo

- `scripts/active-response/firewall-block.ps1`
- `scripts/active-response/firewall-block.cmd`
- `scripts/active-response/ossec-ar-snippet.xml`
- `scripts/patch-ossec-conf.py` — idempotent; validates each `<ossec_config>` block separately.
