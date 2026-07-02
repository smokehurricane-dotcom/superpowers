# Phase 3 - DC step 2: populate domain + weaknesses + agent
$ErrorActionPreference = "Stop"

Import-Module ActiveDirectory

$Domain = "purple.lab"
$BasePath = "DC=purple,DC=lab"

# Identify ADNet adapter for static routes
$adapter = Get-NetAdapter | Where-Object {
    (Get-NetIPAddress -InterfaceAlias $_.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '10.30.0.*' })
}
$ifAlias = $adapter.Name

# Add the local vagrant account to Domain Admins so it can join other machines
Add-ADGroupMember -Identity "Domain Admins" -Members "vagrant" -ErrorAction SilentlyContinue

# OUs
New-ADOrganizationalUnit -Name "LabUsers" -Path $BasePath -ProtectedFromAccidentalDeletion $false -ErrorAction SilentlyContinue
New-ADOrganizationalUnit -Name "ServiceAccounts" -Path $BasePath -ProtectedFromAccidentalDeletion $false -ErrorAction SilentlyContinue

$UsersOU = "OU=LabUsers,$BasePath"
$SvcOU = "OU=ServiceAccounts,$BasePath"

# Helper to create users
function New-LabUser($Name, $OU, $Password) {
    $sec = ConvertTo-SecureString $Password -AsPlainText -Force
    New-ADUser `
        -Name $Name `
        -SamAccountName $Name `
        -UserPrincipalName "$Name@$Domain" `
        -Path $OU `
        -AccountPassword $sec `
        -Enabled $true `
        -PasswordNeverExpires $true `
        -ErrorAction SilentlyContinue
}

# Create regular users
New-LabUser -Name "alice" -OU $UsersOU -Password "Password123!"
New-LabUser -Name "bob" -OU $UsersOU -Password "Summer2024!"
New-LabUser -Name "carol" -OU $UsersOU -Password "Password123!"

# Make alice a member of Domain Admins (intentional over-privilege)
Add-ADGroupMember -Identity "Domain Admins" -Members "alice" -ErrorAction SilentlyContinue

# Create a service account with a weak password and an SPN -> Kerberoastable
New-LabUser -Name "svc_sql" -OU $SvcOU -Password "SqlSvc123!"
Set-ADUser -Identity "svc_sql" -ServicePrincipalNames @{Add="MSSQLSvc/dc01.purple.lab:1433"} -ErrorAction SilentlyContinue

# AS-REP roasting target: bob does not require Kerberos preauthentication
Set-ADAccountControl -Identity "bob" -DoesNotRequirePreAuth $true -ErrorAction SilentlyContinue

# Add an unconstrained delegation-like setup on a fake IIS server account (disabled for safety)
New-LabUser -Name "svc_web" -OU $SvcOU -Password "WebSvc2024!"

# Create a file share with overly permissive ACLs
$SharePath = "C:\Shares\Public"
New-Item -Path $SharePath -ItemType Directory -Force | Out-Null
$acl = Get-Acl $SharePath
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule)
Set-Acl $SharePath $acl
New-SmbShare -Name "Public" -Path $SharePath -FullAccess "Everyone" -ErrorAction SilentlyContinue

# Routes back to the other lab segments via the ADNet gateway (NAT remains default gateway)
New-NetRoute -DestinationPrefix "10.10.0.0/24" -NextHop "10.30.0.2" -InterfaceAlias $ifAlias -RouteMetric 1 -ErrorAction SilentlyContinue | Out-Null
New-NetRoute -DestinationPrefix "10.20.0.0/24" -NextHop "10.30.0.2" -InterfaceAlias $ifAlias -RouteMetric 1 -ErrorAction SilentlyContinue | Out-Null

# Install Wazuh agent (version must match manager)
$WazuhVersion = "4.10.1"
$MsiPath = "C:\Windows\Temp\wazuh-agent-$WazuhVersion-1.msi"
if (-not (Test-Path $MsiPath)) {
    Invoke-WebRequest -Uri "https://packages.wazuh.com/4.x/windows/wazuh-agent-$WazuhVersion-1.msi" -OutFile $MsiPath -UseBasicParsing
}
$arg = "/i `"$MsiPath`" /q WAZUH_MANAGER=`"10.10.0.30`" WAZUH_AGENT_NAME=`"dc01`""
Start-Process -FilePath "msiexec.exe" -ArgumentList $arg -Wait
Start-Service -Name "WazuhSvc" -ErrorAction SilentlyContinue
Set-Service -Name "WazuhSvc" -StartupType Automatic -ErrorAction SilentlyContinue

Write-Host "DC step 2 complete. Domain $Domain is configured."
