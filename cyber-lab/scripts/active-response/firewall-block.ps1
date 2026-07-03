# Wazuh Active Response - Windows Firewall block
# Blocks the source IP from a brute-force alert for the configured TTL.
# Wazuh sends a JSON message via stdin with command "add" or "delete".

param(
    [string]$InputFile
)

$LogPath = "C:\Windows\Temp\wazuh-firewall-block.log"

function Write-Log($Message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $Message"
    Add-Content -Path $LogPath -Value $line -ErrorAction SilentlyContinue
    Write-Output $line
}

function Get-SourceIp($Message) {
    # Try the EventChannel field used by Windows Security events
    $ip = $Message.parameters.alert.data.win.eventdata.ipAddress
    if (-not $ip) { $ip = $Message.parameters.alert.data.srcip }
    if (-not $ip) { $ip = $Message.parameters.srcip }
    return $ip
}

function Get-RuleName($Ip) {
    return "WAZUH-AR-BLOCK-$Ip"
}

# Read JSON from stdin or from supplied file path
try {
    if ($InputFile -and (Test-Path $InputFile)) {
        $json = Get-Content $InputFile -Raw | ConvertFrom-Json
    } else {
        $raw = [Console]::In.ReadToEnd()
        $json = $raw | ConvertFrom-Json
    }
} catch {
    Write-Log "ERROR: failed to parse input JSON: $_"
    exit 1
}

$command = $json.command
$ip = Get-SourceIp $json

if (-not $ip) {
    Write-Log "ERROR: no source IP found in alert"
    exit 1
}

$ruleName = Get-RuleName $ip

try {
    switch ($command) {
        "add" {
            $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
            if (-not $existing) {
                New-NetFirewallRule -DisplayName $ruleName -Name $ruleName `
                    -Direction Inbound -Action Block -RemoteAddress $ip `
                    -Profile Any -Enabled True -ErrorAction Stop | Out-Null
                New-NetFirewallRule -DisplayName "$ruleName-out" -Name "$ruleName-out" `
                    -Direction Outbound -Action Block -RemoteAddress $ip `
                    -Profile Any -Enabled True -ErrorAction Stop | Out-Null
                Write-Log "BLOCKED $ip (rule $ruleName created)"
            } else {
                Write-Log "IDLE $ip (rule $ruleName already exists)"
            }
        }
        "delete" {
            $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
            if ($existing) {
                Remove-NetFirewallRule -Name $ruleName -ErrorAction Stop
                Remove-NetFirewallRule -Name "$ruleName-out" -ErrorAction SilentlyContinue
                Write-Log "UNBLOCKED $ip (rule $ruleName removed)"
            } else {
                Write-Log "IDLE $ip (rule $ruleName not present)"
            }
        }
        default {
            Write-Log "UNKNOWN command: $command"
            exit 1
        }
    }
} catch {
    Write-Log "ERROR executing $command for $ip : $_"
    exit 1
}

exit 0
