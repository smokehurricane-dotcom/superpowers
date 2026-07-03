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

function Get-RequiredEnv($Name) {
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if (-not $Value) { throw "Missing required environment variable: $Name" }
    return $Value
}

# Read account passwords from environment variables
$AlicePw   = Get-RequiredEnv 'LAB_ALICE_PW'
$BobPw     = Get-RequiredEnv 'LAB_BOB_PW'
$CarolPw   = Get-RequiredEnv 'LAB_CAROL_PW'
$SvcSqlPw  = Get-RequiredEnv 'LAB_SVC_SQL_PW'
$SvcWebPw  = Get-RequiredEnv 'LAB_SVC_WEB_PW'

# Create regular users
New-LabUser -Name "alice" -OU $UsersOU -Password $AlicePw
New-LabUser -Name "bob" -OU $UsersOU -Password $BobPw
New-LabUser -Name "carol" -OU $UsersOU -Password $CarolPw

# Make alice a member of Domain Admins (intentional over-privilege)
Add-ADGroupMember -Identity "Domain Admins" -Members "alice" -ErrorAction SilentlyContinue

# Create a service account with a weak password and an SPN -> Kerberoastable
New-LabUser -Name "svc_sql" -OU $SvcOU -Password $SvcSqlPw
Set-ADUser -Identity "svc_sql" -ServicePrincipalNames @{Add="MSSQLSvc/dc01.purple.lab:1433"} -ErrorAction SilentlyContinue

# AS-REP roasting target: bob does not require Kerberos preauthentication
Set-ADAccountControl -Identity "bob" -DoesNotRequirePreAuth $true -ErrorAction SilentlyContinue

# Add an unconstrained delegation-like setup on a fake IIS server account (disabled for safety)
New-LabUser -Name "svc_web" -OU $SvcOU -Password $SvcWebPw

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

# Ensure the Security eventchannel has a valid XPath query.
# MSI reinstall preserves the existing ossec.conf; an empty/broken query breaks
# EvtSubscribe and silently stops Windows Security events from reaching the manager.
$OssecConf = "C:\Program Files (x86)\ossec-agent\ossec.conf"
[xml]$conf = Get-Content $OssecConf
$sec = $conf.ossec_config.localfile | Where-Object { $_.location -eq "Security" }
$query = "Event/System[EventID != 5145 and EventID != 5156 and EventID != 5447 and EventID != 4656 and EventID != 4658 and EventID != 4663 and EventID != 4660 and EventID != 4670 and EventID != 4690 and EventID != 4703 and EventID != 4907 and EventID != 5152 and EventID != 5157]"
if ($sec.query -eq $null) {
    $q = $conf.CreateElement("query")
    $sec.AppendChild($q) | Out-Null
}
$sec.query = $query
$conf.Save($OssecConf)
Restart-Service -Name "WazuhSvc" -ErrorAction SilentlyContinue

Write-Host "DC step 2 complete. Domain $Domain is configured."
