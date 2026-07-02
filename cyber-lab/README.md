# Cyber Lab — Phase 2 (Router + SIEM)

A hybrid purple-team lab on a Windows host using VirtualBox + Vagrant.

## Network

| Segment | CIDR | Members |
|---------|------|---------|
| Lab-Internal | 10.10.0.0/24 | Kali (10.10.0.10), Router inside (10.10.0.2), SIEM (10.10.0.30) |
| TargetNet | 10.20.0.0/24 | Juice Shop target (10.20.0.20), Router target-side (10.20.0.2) |

## VMs

| VM | IP | Purpose |
|----|----|---------|
| `router` | 10.10.0.2 / 10.20.0.2 | iptables router + NAT between segments |
| `siem` | 10.10.0.30 | Wazuh single-node SIEM (https://10.10.0.30) |
| `kali` | 10.10.0.10 | Attack platform + Wazuh agent |
| `target` | 10.20.0.20 | OWASP Juice Shop + Wazuh agent |

## Quick start

```powershell
cd cyber-lab
$env:PATH += ";C:\Program Files\Vagrant\bin"
vagrant up
```

## Verify from Kali

```bash
vagrant ssh kali
ping -c 2 10.20.0.20
nmap -sV -p 3000 10.20.0.20
curl -sk https://10.10.0.30
```

## Wazuh dashboard

- URL: https://10.10.0.30
- Username: `admin`
- Password: `SecretPassword`

Both the Kali and target VMs are registered as agents.

## Tools

See `tools/`:
- `recon.py` — nmap wrapper that emits JSON findings
- `report_generator.py` — HTML report from findings JSON
- `dashboard.py` — static HTML dashboard from findings JSON

## Revert everything to Phase 2 clean state

Use VirtualBox snapshots named `clean-phase2` on each VM, or run:

```powershell
vagrant destroy -f
vagrant up
```

## Rebuild from scratch

```powershell
.\rebuild-lab.ps1
```
