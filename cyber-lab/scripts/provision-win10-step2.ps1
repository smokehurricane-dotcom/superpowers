# Phase 3 - Windows 10 step 2: post-domain-join hardening/visibility
$ErrorActionPreference = "Stop"

# Disable Windows Firewall consistently across all profiles
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False

# Enable RDP for remote access from the lab
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop" -ErrorAction SilentlyContinue

# Install Wazuh agent (version must match manager)
$WazuhVersion = "4.10.1"
$MsiPath = "C:\Windows\Temp\wazuh-agent-$WazuhVersion-1.msi"
if (-not (Test-Path $MsiPath)) {
    Invoke-WebRequest -Uri "https://packages.wazuh.com/4.x/windows/wazuh-agent-$WazuhVersion-1.msi" -OutFile $MsiPath -UseBasicParsing
}
$arg = "/i `"$MsiPath`" /q WAZUH_MANAGER=`"10.10.0.30`" WAZUH_AGENT_NAME=`"win10-1`""
Start-Process -FilePath "msiexec.exe" -ArgumentList $arg -Wait
Start-Service -Name "WazuhSvc" -ErrorAction SilentlyContinue
Set-Service -Name "WazuhSvc" -StartupType Automatic -ErrorAction SilentlyContinue

# Routes back to the other lab segments (NAT remains default gateway)
route -p add 10.10.0.0 mask 255.255.255.0 10.30.0.2 -ErrorAction SilentlyContinue | Out-Null
route -p add 10.20.0.0 mask 255.255.255.0 10.30.0.2 -ErrorAction SilentlyContinue | Out-Null

Write-Host "Windows 10 step 2 complete."
