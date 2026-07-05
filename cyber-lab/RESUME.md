# Resume Point — 2026-07-04 EOD

Status: root cause found for the last Active Response gap. Stopping here for the night.

## DONE today

- Detection proven on the manager-only SIEM: SMB brute-force from Kali fires Wazuh rule `100303` ✅
- Active Response pipeline proven live end-to-end with the built-in `firewall-drop` command (add → block → timeout) ✅
- Custom command acceptance solved: the Linux manager now registers our own `firewall-block` command via a cross-platform Python script (no file extension) with `root:wazuh` ownership and mode `750` ✅
- Bisected placement, `rules_id`, and `level`: relocated the `<active-response>` block and the built-in `firewall-drop` still fires, so placement is not the issue ✅

## ROOT CAUSE of the remaining gap (found and proven)

Our `firewall-block` Python script does **not** answer Wazuh's `check_keys` handshake.

When a stateful AR command has `<timeout_allowed>yes</timeout_allowed>`, `wazuh-analysisd`/`wazuh-execd` probe it with a message like:

```json
{"version":1,"origin":{"name":"node01","module":"wazuh-execd"},"command":"check_keys","parameters":{"keys":["192.168.1.99"]}}
```

The built-in `firewall-drop` script answers this handshake and registers as usable. Our script exits 0 with no output, so `analysisd` silently drops the custom command.

**Proof:** swapping only the `<command>` in the exact same `<active-response>` block from `firewall-block` to `firewall-drop` made it fire. The failure is specific to our script, not the block placement or rule match.

## NEXT STEP (tomorrow, ~10 min)

Teach `firewall-block` the `check_keys` handshake:

1. Read the built-in `/var/ossec/active-response/bin/firewall-drop` inside the manager container for the exact continue/abort JSON.
2. Replicate that logic at the top of our Python script.
3. Keep the existing Linux server-side noop and Windows add/delete firewall logic unchanged.
4. Redeploy to `/var/ossec/active-response/bin/firewall-block` with `root:wazuh` and mode `750`.
5. Switch `<command>` in the `<active-response>` block back to `firewall-block` and restart the manager.
6. Run `/tmp/inject.py` and verify a `firewall-block` entry appears in `/var/ossec/logs/active-responses.log`.

Then:
- Switch `<location>` back to `local`.
- Deploy the script to the DC agent's `active-response\bin\`.
- Restore `<timeout>600</timeout>`.
- Document the DC live-fire test as RAM-gated: verify from Kali side (SMB connection dropped), not via DC WinRM under load.

## Current config state

The `<active-response>` block in `/var/ossec/etc/ossec.conf` is currently in **test/bisect state**:

```xml
<command>
  <name>firewall-block</name>
  <executable>firewall-block</executable>
  <timeout_allowed>yes</timeout_allowed>
</command>

<active-response>
  <disabled>no</disabled>
  <command>firewall-drop</command>   <!-- temporary bisect value; switch back to firewall-block for the fix -->
  <location>server</location>
  <rules_id>5710</rules_id>
  <level>3</level>
  <timeout>60</timeout>
</active-response>
```

Important: `firewall-block` and `firewall-drop` `<command>` definitions both exist. The `<active-response>` block is pointed at `firewall-drop` for the bisect.

## Snapshots saved today (SIEM `lab-siem`)

- `manager-only-stable`
- `ar-applied`
- `ar-debug`
- `ar-bisect`
- `ar-synthetic`
- `ar-optionb`
- `ar-placement`
- `ar-debug-log`
- `ar-bisect2`
- `resume-2026-07-04-eod` *(current, marked with `*`)*

## Resource / RAM lesson

The host has 16 GB of soldered RAM and cannot keep `siem`, `dc01`, and `kali` all healthy at once. When all three run, the DC's network stack collapses (WinRM becomes unreliable or fails).

**Rule:** do manager-only proofs with the DC/Kali halted. Verify DC-side actions from the Kali side of the connection (e.g., the SMB session is dropped), never rely on DC WinRM while the full lab is under load.

---

## Prior resume (2026-07-03) — kept for reference

See git history for the old `RESUME.md` content.
