# downloads Press Start 2P webfont files into assets/fonts/
# Usage: run this script from the project root in PowerShell

$fontsDir = Join-Path -Path (Get-Location) -ChildPath 'assets/fonts'
if (-not (Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Path $fontsDir | Out-Null
}

$cssUrl = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
Write-Host "Fetching CSS from: $cssUrl"
try {
    $css = Invoke-WebRequest -Uri $cssUrl -UseBasicParsing -ErrorAction Stop
} catch {
    Write-Error "Failed to fetch CSS: $_"
    exit 2
}

$body = $css.Content
if (-not $body) {
    Write-Error "Empty CSS body"
    exit 3
}

$found = $false
[regex]::Matches($body, 'url\(([^)]+)\)') | ForEach-Object {
    $raw = $_.Groups[1].Value
    # strip quotes and whitespace
    $url = $raw -replace "[\"'\s]", ""
    if ($url -match '\.woff2($|\?)') {
        $out = Join-Path $fontsDir 'PressStart2P.woff2'
        Write-Host "Downloading WOFF2: $url -> $out"
        try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -ErrorAction Stop; $found = $true } catch { Write-Warning "Failed to download woff2: $_" }
    } elseif ($url -match '\.woff($|\?)') {
        $out = Join-Path $fontsDir 'PressStart2P.woff'
        Write-Host "Downloading WOFF: $url -> $out"
        try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -ErrorAction Stop; $found = $true } catch { Write-Warning "Failed to download woff: $_" }
    }
}

if (-not $found) {
    Write-Warning "No WOFF/WOFF2 URL found in CSS. Here's the CSS content for debugging:"
    Write-Host $body
    exit 4
}

Write-Host "Done. Font files (if found) are in: $fontsDir"
