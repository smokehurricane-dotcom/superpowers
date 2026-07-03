# Cyber Lab Roadmap / TODO

Living backlog of improvements and next slices for the purple-team lab.  
Sorted by theme, not strict priority — pick a slice and move it through the dev-team workflow.

## Legend

| Priority | Meaning |
|----------|---------|
| 🔴 High | Closes a known gap or directly improves portfolio/demo value. |
| 🟡 Medium | Nice-to-have that builds on existing infrastructure. |
| 🟢 Low | Stretch goal or requires major new components. |

---

## 1. Finish Phase 5C leftovers

| # | Task | Priority | Status | Notes / Acceptance |
|---|------|----------|--------|-------------------|
| 1.1 | Move `firewall-block.ps1` into the Wazuh agent's `active-response\bin\` directory on the DC | 🔴 High | todo | Required before execd can call it. |
| 1.2 | Add clean `<command>` + `<active-response>` block to `ossec.conf` via the file-bytes method | 🔴 High | todo | Use host-file → base64 → `docker cp`, no inline escaping. |
| 1.3 | Live-verify firewall block: trigger SMB brute-force and confirm inbound block + rule removal after timeout | 🔴 High | todo | Evidence: `active-responses.log` + `Get-NetFirewallRule`. |
| 1.4 | Extend AR to a second action (e.g. disable AD user or isolate host) | 🟡 Medium | todo | Start with one, then generalize. |

## 2. Detection engineering

| # | Task | Priority | Status | Notes / Acceptance |
|---|------|----------|--------|-------------------|
| 2.1 | Add Sysmon to DC/win10 and ingest Event ID 1 (process creation) with command-line logging | 🔴 High | todo | Enables PowerShell/lateral-movement detections. |
| 2.2 | Add rules for common post-exploitation: PsExec / WMI / RDP lateral movement | 🔴 High | todo | Needs Sysmon or Security 4688. |
| 2.3 | Add LDAP signing / LDAPS enumeration detection | 🟡 Medium | todo | BloodHound / SharpHound indicators. |
| 2.4 | Add PetitPotam / NTLM relay indicators | 🟡 Medium | todo | MS-EFSRPC events + authentication anomalies. |
| 2.5 | Add DCShadow detection | 🟢 Low | todo | Requires specific 5137/5141 patterns + replication anomalies. |
| 2.6 | Add Linux auditd rules for the `target` VM (Juice Shop is currently only a red target) | 🟡 Medium | todo | Brute-force / file-integrity / web-shell. |
| 2.7 | Add a rule CI harness: feed sample events into `wazuh-logtest` and fail on regression | 🔴 High | todo | Test each custom rule with a known-good JSON sample. |

## 3. Infrastructure & observability

| # | Task | Priority | Status | Notes / Acceptance |
|---|------|----------|--------|-------------------|
| 3.1 | Add Zeek or Suricata on the router for network-layer detection | 🟡 Medium | todo | Correlate network alerts with host alerts. |
| 3.2 | Central agent health dashboard / lab status page | 🟡 Medium | todo | Simple web page showing VM/agent status and last alert. |
| 3.3 | Backup/restore Wazuh manager config (rules, ossec.conf, integrations) to git on change | 🟡 Medium | todo | Prevent re-doing manual container edits. |
| 3.4 | Automate integration deployment in the SIEM provisioner | 🔴 High | todo | `custom-wazuh-notify`, MITRE cache, env file, ossec.conf block. |
| 3.5 | Add a second DC or a Linux AD-joined member for cross-OS scenarios | 🟢 Low | todo | Requires more RAM; nice for forest-trust / relay labs. |

## 4. Purple-team automation & metrics

| # | Task | Priority | Status | Notes / Acceptance |
|---|------|----------|--------|-------------------|
| 4.1 | Build an attack scheduler that runs one ATT&CK technique per hour and checks detection | 🟡 Medium | todo | Output: detection time per technique. |
| 4.2 | MTTD dashboard: time from attack execution to alert + webhook delivery | 🟡 Medium | todo | Reuses webhook receiver + alert timestamp. |
| 4.3 | Atomic Red Team or Caldera integration for repeatable test cases | 🟢 Low | todo | Replaces hand-rolled attack commands. |
| 4.4 | Generate a weekly "purple-team report" (attacks run, detections, gaps) | 🟢 Low | todo | Markdown or PDF artifact. |

## 5. Response / SOAR light

| # | Task | Priority | Status | Notes / Acceptance |
|---|------|----------|--------|-------------------|
| 5.1 | Add TheHive/Cortex case-management container | 🟢 Low | todo | Big new component; high portfolio value. |
| 5.2 | Add a minimal SOAR playbook: alert → webhook → case created automatically | 🟡 Medium | todo | Can be done with a small Python service before TheHive. |
| 5.3 | Add Velociraptor IR agent on Windows endpoints | 🟢 Low | todo | Remote artifact collection for incident response. |

## 6. Documentation & portfolio

| # | Task | Priority | Status | Notes / Acceptance |
|---|------|----------|--------|-------------------|
| 6.1 | Convert detection playbooks into a small MkDocs site | 🟡 Medium | todo | Easier to share than raw Markdown files. |
| 6.2 | Add an attack→detection→mitigation mapping table per technique | 🟡 Medium | todo | Shows purple-team value end-to-end. |
| 6.3 | Record short terminal GIFs / asciinema casts of key attacks + detections | 🟢 Low | todo | Portfolio eye-candy. |
| 6.4 | Add a "lessons learned" page per phase in `docs/` | 🟡 Medium | todo | Already captured in `LESSONS.md`; split for readability. |

---

## Suggested next slice

**Finish Active Response end-to-end (1.1–1.3).**  
It closes Phase 5C honestly, is demoable, and teaches the file-bytes method for nested contexts.

Done =:
- `firewall-block.ps1` is in the agent's `active-response\bin\`.
- `<command>` + `<active-response>` blocks are in `ossec.conf` and the manager starts cleanly.
- A live SMB brute-force attack creates a block rule, blocks traffic, and the rule auto-removes after timeout.
- Evidence captured in `docs/response/README.md`.
