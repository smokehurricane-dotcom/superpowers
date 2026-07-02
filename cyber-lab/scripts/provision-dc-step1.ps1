# Phase 3 - DC step 1: promote to domain controller
$ErrorActionPreference = "Stop"

Start-Transcript -Path C:\Windows\Temp\provision-dc-step1.log -Force

$DomainName = "purple.lab"
$NetbiosName = "PURPLE"
$SafeModePassword = "P@ssw0rd1234!"

Write-Host "Step 1: disabling firewall for lab use..."
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False

Write-Host "Step 2: identifying ADNet adapter..."
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

Write-Host "Step 3: configuring static IP and DNS..."
$existing = Get-NetIPAddress -InterfaceAlias $ifAlias -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -eq '10.30.0.10' }
if (-not $existing) {
    New-NetIPAddress -InterfaceAlias $ifAlias -IPAddress 10.30.0.10 -PrefixLength 24 -DefaultGateway 10.30.0.2 -Confirm:$false | Out-Null
}
Set-DnsClientServerAddress -InterfaceAlias $ifAlias -ServerAddresses @('127.0.0.1','10.30.0.10') -Confirm:$false

Write-Host "Step 4: installing AD-Domain-Services + DNS + tools..."
Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools -IncludeAllSubFeature
Import-Module ADDSDeployment

Write-Host "Step 5: promoting forest (this may take several minutes)..."
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
    -Force:$true |
    Out-File -FilePath C:\Windows\Temp\dcpromo.log -Append -Encoding utf8

Write-Host "Step 6: DC promotion complete. Reboot will be triggered by Vagrant."
Stop-Transcript
