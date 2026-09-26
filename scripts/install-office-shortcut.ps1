[CmdletBinding()]
param([string]$Destination = [Environment]::GetFolderPath('Desktop'), [switch]$Stop)

$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$launcherName = if ($Stop) { 'stop-office.ps1' } else { 'start-office.ps1' }
$shortcutName = if ($Stop) { 'AI Office - Kapat' } else { 'AI Office' }
$launcher = Join-Path $PSScriptRoot $launcherName
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $Destination -PathType Container)) { throw 'Kisayol klasoru bulunamadi.' }
$shell = New-Object -ComObject WScript.Shell
$arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $launcher + '"'
$shortcutPath = Join-Path $Destination ($shortcutName + '.lnk')
$suffix = 1
while (Test-Path -LiteralPath $shortcutPath) {
    $existing = $shell.CreateShortcut($shortcutPath)
    if ($existing.TargetPath -eq $powershellPath -and $existing.Arguments -eq $arguments) { break }
    $suffix++
    $shortcutPath = Join-Path $Destination ($shortcutName + ' (' + $suffix + ').lnk')
}
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $repoPath
$shortcut.Description = if ($Stop) { 'AI Office sunucusunu ve otomatik yeniden baslatmayi kapat.' } else { 'AI Office ofisini ac; calisiyorsa mevcut sunucuyu kullan.' }
$shortcut.WindowStyle = 7
$shortcut.IconLocation = (Join-Path $env:SystemRoot 'System32\shell32.dll') + ',15'
$shortcut.Save()
Write-Output $shortcutPath
