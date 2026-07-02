# Phase 3 - DC step 1: promote to domain controller
$ErrorActionPreference = "Stop"

$DomainName = "purple.lab"
$NetbiosName = "PURPLE"
$SafeModePassword = "P@ssw0rd1234!"

# Disable Windows Firewall for lab use
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False

# Identify the ADNet host-only adapter and ensure DNS points to self
$adapter = Get-NetAdapter | Where-Object {
    $_.Status -eq 'Up' -and
    (Get-NetIPAddress -InterfaceAlias $_.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '10.30.0.*' })
}
if (-not $adapter) {
    throw "ADNet adapter not found"
}
$ifAlias = $adapter.Name
Write-Host "ADNet adapter: $ifAlias"

# Set static IP if not already configured
$existing = Get-NetIPAddress -InterfaceAlias $ifAlias -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -eq '10.30.0.10' }
if (-not $existing) {
    New-NetIPAddress -InterfaceAlias $ifAlias -IPAddress 10.30.0.10 -PrefixLength 24 -DefaultGateway 10.30.0.2 -Confirm:$false | Out-Null
}
Set-DnsClientServerAddress -InterfaceAlias $ifAlias -ServerAddresses @('127.0.0.1','10.30.0.10') -Confirm:$false

# Install AD DS + DNS
Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools -IncludeAllSubFeature
Import-Module ADDSDeployment

$SecurePassword = ConvertTo-SecureString $SafeModePassword -AsPlainText -Force

Install-ADDSForest `
    -DomainName $DomainName `
    -DomainNetbiosName $NetbiosName `
    -ForestMode "WinThreshold" `
    -DomainMode "WinThreshold" `
    -InstallDns:$true `
    -CreateDnsDelegation:$false `
    -DatabasePath "C:\Windows\NTDS" `
    -LogPath "C:\Windows\NTDS" `
    -SysvolPath "C:\Windows\SYSVOL" `
    -SafeModeAdministratorPassword $SecurePassword `
    -NoRebootOnCompletion:$true `
    -Force:$true

Write-Host "DC promotion complete. Reboot will be triggered by Vagrant."
