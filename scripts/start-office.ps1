[CmdletBinding()]
param(
    [int]$Port = 0,
    [switch]$NoBrowser,
    [switch]$Json,
    [ValidateRange(5, 120)][int]$StartupTimeoutSeconds = 45,
    [ValidateSet('start', 'stop', 'status')][string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Find-NodeRuntime {
    $candidates = @()
    $command = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    if ($env:ProgramFiles) { $candidates += Join-Path $env:ProgramFiles 'nodejs\node.exe' }
    if ($env:USERPROFILE) {
        $candidates += Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $versionText = & $candidate --version 2>$null
            if ($LASTEXITCODE -ne 0) { continue }
            $version = [version](([string]$versionText).Trim().TrimStart('v'))
            if ($version.Major -eq 24 -and $version.Minor -ge 13) { return $candidate }
        } catch { continue }
    }
    throw 'Node.js 24.13 veya daha yeni bir 24.x bulunamadi. Node.js kurulumunu kontrol et.'
}

$mutex = $null
$ownsMutex = $false
try {
    if ($Port -eq 0) { $Port = if ($env:CHELEBY_PORT) { [int]$env:CHELEBY_PORT } else { 4317 } }
    if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Ofis portu 1024-65535 araliginda olmali.' }
    $nodePath = Find-NodeRuntime
    if ($Action -eq 'start') {
        # Serialize user clicks; the supervisor's IPC lease also covers restarts.
        $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $mutex = New-Object System.Threading.Mutex($false, ('Local\ChelebyHome-' + $sid + '-' + $Port))
        try { $ownsMutex = $mutex.WaitOne([TimeSpan]::FromSeconds($StartupTimeoutSeconds + 65)) }
        catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
        if (-not $ownsMutex) { throw 'Baska bir ofis acilisi suruyor. Biraz sonra yeniden dene.' }
    }
    # Stop deliberately bypasses the launch mutex so it can cancel preparation.
    $runtime = Join-Path $PSScriptRoot 'office-runtime.mjs'
    $output = & $nodePath $runtime $Action ([string]$Port) ([string]$StartupTimeoutSeconds)
    $result = $output | Select-Object -Last 1 | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $result.status -eq 'error') { throw $result.message }
    if ($Json) { $result | ConvertTo-Json -Compress }
    elseif ($Action -eq 'start') { Write-Output ('AI Office hazir: ' + $result.url) }
    elseif ($Action -eq 'stop') { Write-Output 'AI Office kapatildi.' }
    else { $result | ConvertTo-Json -Compress }
    if ($Action -eq 'start' -and -not $NoBrowser) { Start-Process -FilePath $result.url | Out-Null }
} catch {
    $failure = $_.Exception.Message
    if ($Json) { [ordered]@{ status = 'error'; message = $failure } | ConvertTo-Json -Compress }
    elseif ($NoBrowser) { [Console]::Error.WriteLine($failure) }
    else {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($failure, 'AI Office', 'OK', 'Error') | Out-Null
    }
    exit 1
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
