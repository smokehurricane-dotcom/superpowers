# Phase 3 - Windows 10 step 1: prepare and join domain
$ErrorActionPreference = "Stop"

function Get-RequiredEnv($Name) {
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if (-not $Value) { throw "Missing required environment variable: $Name" }
    return $Value
}

# Disable Windows Firewall for lab use
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False

# Identify ADNet adapter and point DNS to the DC
$adapter = Get-NetAdapter | Where-Object {
    (Get-NetIPAddress -InterfaceAlias $_.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '10.30.0.*' })
}
if (-not $adapter) {
    throw "ADNet adapter not found"
}
$ifAlias = $adapter.Name
Write-Host "ADNet adapter: $ifAlias"

# Ensure static IP
$existing = Get-NetIPAddress -InterfaceAlias $ifAlias -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -eq '10.30.0.11' }
if (-not $existing) {
    New-NetIPAddress -InterfaceAlias $ifAlias -IPAddress 10.30.0.11 -PrefixLength 24 -DefaultGateway 10.30.0.2 -Confirm:$false | Out-Null
}
Set-DnsClientServerAddress -InterfaceAlias $ifAlias -ServerAddresses @('10.30.0.10') -Confirm:$false

# Join domain using the vagrant account (added to Domain Admins in DC step 2)
$VagrantPw = Get-RequiredEnv 'LAB_VAGRANT_PW'
$password = ConvertTo-SecureString $VagrantPw -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential("purple.lab\vagrant", $password)
Add-Computer -DomainName "purple.lab" -Credential $credential -Force

Write-Host "Domain join complete. Reboot will be triggered by Vagrant."
