# Rebuild the local Phase 1 lab from scratch.
# Run from the cyber-lab directory.
$ErrorActionPreference = "Stop"

Write-Host "[*] Destroying existing VMs..."
vagrant destroy -f

Write-Host "[*] Removing old boxes (optional — keep to save bandwidth)..."
# vagrant box remove kalilinux/rolling --provider virtualbox -f
# vagrant box remove ubuntu/jammy64 --provider virtualbox -f

Write-Host "[*] Building lab..."
vagrant up

Write-Host "[+] Lab rebuild complete."
Write-Host "    Kali:    vagrant ssh kali"
Write-Host "    Target:  http://10.10.0.20:3000"
