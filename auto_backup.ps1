$logFile = "C:\Users\jatro\Dev\auto_backup.log"
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMsg = "Auto-Sync Backup: $dateStr"

Write-Output "" | Out-File -Append $logFile
Write-Output "========================================" | Out-File -Append $logFile
Write-Output "[$dateStr] Starting automated backup job" | Out-File -Append $logFile

Function Backup-Repo($path) {
    if (Test-Path "$path\.git") {
        Write-Output "[$dateStr] Processing $path" | Out-File -Append $logFile
        Set-Location $path
        
        # Check if there are changes
        $status = git status --porcelain
        if ($status) {
            Write-Output "[$dateStr] Changes found. Committing..." | Out-File -Append $logFile
            git add .
            git commit -m $commitMsg
            
            # Push changes
            $pushOutput = git push origin main 2>&1
            Write-Output "[$dateStr] Push completed: $pushOutput" | Out-File -Append $logFile
        } else {
            Write-Output "[$dateStr] No changes to backup." | Out-File -Append $logFile
        }
    } else {
        Write-Output "[$dateStr] Error: Git repository not found at $path" | Out-File -Append $logFile
    }
}

try {
    # Backup cal_airb_api
    Backup-Repo "C:\Users\jatro\Dev\cal_airb_api"

    # Backup adminfuct
    Backup-Repo "C:\Users\jatro\Dev\adminfuct"
} catch {
    Write-Output "[$dateStr] CRITICAL ERROR: $_" | Out-File -Append $logFile
}

Write-Output "[$dateStr] Backup job finished." | Out-File -Append $logFile
