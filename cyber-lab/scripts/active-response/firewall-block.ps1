$Log = "C:\wazuh-ar\firewall-block.log"
function Write-Log($m){ "$(Get-Date -Format o) $m" | Out-File $Log -Append }
try {
    $stdin = $input | Out-String
    $alert = $stdin | ConvertFrom-Json -ErrorAction Stop
    $action = $alert.parameters.extra_args[0]
    if (-not $action) { $action = "add" }
    $ip = $alert.parameters.alert.data.win.eventdata.ipAddress
    if (-not $ip) { $ip = $alert.parameters.alert.data.srcip }
    if (-not $ip) { throw "No attacker IP found" }

    # Harden: never block the manager or the router
    $protectedIPs = @("10.10.0.30", "10.30.0.2")
    if ($protectedIPs -contains $ip) {
        Write-Log "SKIP: protected IP $ip will not be blocked"
        exit 0
    }

    $name = "WAZUH-AR-BLOCK-$($ip -replace '\.', '-')"
    if ($action -eq "add") {
        Write-Log "Blocking $ip"
        New-NetFirewallRule -Name $name -DisplayName $name -Direction Inbound -Action Block -RemoteAddress $ip -Profile Any -Enabled True | Out-Null
        New-NetFirewallRule -Name "$name-out" -DisplayName "$name-out" -Direction Outbound -Action Block -RemoteAddress $ip -Profile Any -Enabled True | Out-Null
    } elseif ($action -eq "delete") {
        Write-Log "Unblocking $ip"
        Remove-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
        Remove-NetFirewallRule -Name "$name-out" -ErrorAction SilentlyContinue
    } else {
        Write-Log "Unknown action: $action"
    }
} catch {
    Write-Log "ERROR: $_"
}
