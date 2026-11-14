# Ensures the local Stochia API is running from a binary that matches the source.
# A listening server is left alone when `cargo build` does not need to replace it.
# If the link fails because that executable is locked, or the file is newer than the
# process, the process is stopped, rebuilt, and started again.

$ErrorActionPreference = "Stop"

$stochiaRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\stochia")).Path
$listenPort = 5917

function Get-ListenerProcessId([int]$Port) {
    $matches = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    foreach ($match in $matches) {
        $parts = ($match.Line -split "\s+") | Where-Object { $_ -ne "" }
        $candidate = $parts[-1]
        if ($candidate -match "^\d+$" -and [int]$candidate -gt 0) {
            return [int]$candidate
        }
    }
    return $null
}

function Get-StochiaProcess([int]$ProcessId) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
    if (-not $process) {
        return $null
    }
    if ($process.Name -ne "stochia-api.exe") {
        throw "Le port $listenPort est pris par $($process.Name) (pid $ProcessId), pas par stochia-api."
    }
    return $process
}

function Get-BuildProfile($ExecutablePath) {
    if ($ExecutablePath -and $ExecutablePath -match "\\target\\release\\") {
        return "release"
    }
    return "debug"
}

function Set-StochiaDataEnvironment([string]$Root) {
    function Use-File($Name, $Path) {
        if (-not (Test-Path -LiteralPath $Path)) {
            return
        }
        if (-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($Name))) {
            return
        }
        Set-Item -Path "Env:$Name" -Value $Path
        Write-Host "$Name=$Path"
    }

    Use-File "STOCHIA_FINE_GRID" (Join-Path $Root "data\ghsl_fine.bin")
    Use-File "STOCHIA_CLIMATE" (Join-Path $Root "data\stochcl1.bin")
    Use-File "STOCHIA_CLIMATE" "D:\stochia-data\climate\stochcl1.bin"
    Use-File "STOCHIA_HEAT" (Join-Path $Root "data\stochhx1.bin")
    Use-File "STOCHIA_HEAT" "D:\stochia-data\heat\stochhx1.bin"
    Use-File "STOCHIA_HAZARDS" (Join-Path $Root "data\stochhz1.bin")
    Use-File "STOCHIA_HAZARDS" "D:\stochia-data\hazards\stochhz1.bin"
}

function Invoke-StochiaBuild([string]$Root, [string]$BuildProfile) {
    $arguments = @("build", "-p", "stochia-api")
    if ($BuildProfile -eq "release") {
        $arguments += "--release"
    }
    $log = Join-Path $env:TEMP "karmageddon-stochia-build.log"
    Write-Host "cargo $($arguments -join ' ') ($Root)"
    Set-Content -Path $log -Value ""
    Push-Location $Root
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & cargo @arguments 2>&1 | ForEach-Object {
            $line = $_.ToString()
            Write-Host $line
            Add-Content -Path $log -Value $line
        }
        $exit = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
        Pop-Location
    }
    return @{
        Exit = $exit
        Locked = (Select-String -Path $log -Pattern "LNK1104|os error 5|Access is denied|Accès refusé|being used by another process" -Quiet)
    }
}

function Stop-Stochia([int]$ProcessId) {
    Write-Host "Arrêt de stochia-api (pid $ProcessId)."
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-ListenerProcessId $listenPort)) {
            return
        }
        Start-Sleep -Milliseconds 300
    }
    throw "stochia-api occupe encore le port $listenPort."
}

function Start-Stochia([string]$Executable, [string]$Root) {
    Set-StochiaDataEnvironment $Root
    Write-Host "Démarrage de $Executable"
    Start-Process -FilePath $Executable -WorkingDirectory $Root | Out-Null
}

function Wait-Stochia {
    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
        if (Get-ListenerProcessId $listenPort) {
            Write-Host "STOCHIA API listening on http://127.0.0.1:${listenPort}"
            return
        }
        Start-Sleep -Milliseconds 500
    }
    throw "stochia-api n'a pas ouvert le port $listenPort."
}

$listener = Get-ListenerProcessId $listenPort
$running = $null
if ($listener) {
    $running = Get-StochiaProcess $listener
    Write-Host "stochia-api écoute déjà (pid $listener)."
}

$buildProfile = Get-BuildProfile $running.ExecutablePath
$executable = Join-Path $stochiaRoot "target\$buildProfile\stochia-api.exe"
$before = $null
if (Test-Path -LiteralPath $executable) {
    $before = (Get-Item -LiteralPath $executable).LastWriteTimeUtc
}

$build = Invoke-StochiaBuild $stochiaRoot $buildProfile
if ($build.Exit -ne 0) {
    if (-not $listener -or -not $build.Locked) {
        exit $build.Exit
    }
    Write-Host "Le binaire en cours est verrouillé et doit être remplacé. Relance."
    Stop-Stochia $listener
    $listener = $null
    $running = $null
    $build = Invoke-StochiaBuild $stochiaRoot $buildProfile
    if ($build.Exit -ne 0) {
        exit $build.Exit
    }
}

if (-not (Test-Path -LiteralPath $executable)) {
    throw "Binaire introuvable : $executable"
}

$after = (Get-Item -LiteralPath $executable).LastWriteTimeUtc
$rebuilt = ($null -eq $before) -or ($after -gt $before.AddSeconds(1))

if ($listener -and $running) {
    $startedAt = $running.CreationDate
    $binaryIsNewer = $startedAt -and ($after -gt $startedAt.ToUniversalTime().AddSeconds(2))
    if ($rebuilt -or $binaryIsNewer) {
        Write-Host "Le binaire est plus récent que le processus. Relance."
        Stop-Stochia $listener
        $listener = $null
    }
    else {
        Write-Host "Le binaire est à jour. Le serveur en place est conservé."
        exit 0
    }
}

Start-Stochia $executable $stochiaRoot
Wait-Stochia
