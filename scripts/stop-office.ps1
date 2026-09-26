[CmdletBinding()]
param([int]$Port = 0, [switch]$Json)
& (Join-Path $PSScriptRoot 'start-office.ps1') -Action stop -Port $Port -Json:$Json
exit $LASTEXITCODE
