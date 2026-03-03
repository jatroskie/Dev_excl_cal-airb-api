Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = "C:\Users\jatro\Dev\Dev_3Feb2026.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

foreach ($entry in $zip.Entries) {
    if ([string]::IsNullOrEmpty($entry.Name)) { continue } # Skip directories
    
    # We need to see how the zip handles paths. Let's just output the first few entries to see the common root if any.
}

# Just output 5 entries
$zip.Entries | Select-Object FullName, LastWriteTime | Select-Object -First 5

$zip.Dispose()
