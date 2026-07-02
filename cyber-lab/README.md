# Cyber Lab — Phase 1

A minimal purple-team footprint: one attack VM (Kali) and one vulnerable target (OWASP Juice Shop) on a private VirtualBox network.

## Quick start

```powershell
cd cyber-lab
export PATH="$PATH:/c/Program Files/Vagrant/bin"
vagrant up
```

## VMs

| VM | IP | Purpose |
|----|----|---------|
| `kali` | 10.10.0.10 | Attack platform |
| `target` | 10.10.0.20 | OWASP Juice Shop on port 3000 |

## Verify from Kali

```bash
vagrant ssh kali
nmap -sV 10.10.0.20
```

You should see port 3000 open.

## Revert

```bash
vagrant destroy -f
```
