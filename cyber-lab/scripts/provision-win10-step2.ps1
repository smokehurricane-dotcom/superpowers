# Phase 3 - Windows 10 step 2: post-domain-join hardening/visibility
$ErrorActionPreference = "Stop"

function Get-RequiredEnv($Name) {
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if (-not $Value) { throw "Missing required environment variable: $Name" }
    return $Value
}

# Disable Windows Firewall consistently across all profiles
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False

# Identify ADNet adapter for static routes
$adapter = Get-NetAdapter | Where-Object {
    (Get-NetIPAddress -InterfaceAlias $_.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '10.30.0.*' })
}
$ifAlias = $adapter.Name

# Enable RDP for remote access from the lab
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop" -ErrorAction SilentlyContinue

# Routes back to the other lab segments via the ADNet gateway (NAT remains default gateway)
New-NetRoute -DestinationPrefix "10.10.0.0/24" -NextHop "10.30.0.2" -InterfaceAlias $ifAlias -RouteMetric 1 -ErrorAction SilentlyContinue | Out-Null
New-NetRoute -DestinationPrefix "10.20.0.0/24" -NextHop "10.30.0.2" -InterfaceAlias $ifAlias -RouteMetric 1 -ErrorAction SilentlyContinue | Out-Null

# Ensure the domain secure channel is healthy before starting services that query AD
$VagrantPw = Get-RequiredEnv 'LAB_VAGRANT_PW'
$password = ConvertTo-SecureString $VagrantPw -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential("purple.lab\vagrant", $password)
if (-not (Test-ComputerSecureChannel -Server "dc01.purple.lab" -ErrorAction SilentlyContinue)) {
    Write-Host "Repairing domain secure channel..."
    Test-ComputerSecureChannel -Repair -Server "dc01.purple.lab" -Credential $credential -ErrorAction Stop
}

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

Write-Host "Windows 10 step 2 complete."
