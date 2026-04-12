$taskName = "DailyGitBackup"
$scriptPath = "C:\Users\jatro\Dev\auto_backup.ps1"

# Create action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Create trigger (Daily at 3:00 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM

# Optional: Run as the current user, highest privileges for silent background execution
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -WakeToRun

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Automated daily Git backup for Dev projects" -Force
    Write-Output "Task scheduled successfully."
} catch {
    Write-Output "Error scheduling task: $_"
}
