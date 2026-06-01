$ErrorActionPreference = "Stop"

$chromeCandidates = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

$browser = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  throw "No Chrome or Edge executable found."
}

function Assert-DomContains {
  param(
    [string]$Url,
    [string[]]$Patterns
  )

  $tmp = Join-Path $env:TEMP ("fabricmind-browser-smoke-" + [guid]::NewGuid().ToString() + ".txt")
  $command = "`"$browser`" --headless=new --disable-gpu --virtual-time-budget=8000 --dump-dom `"$Url`" > `"$tmp`" 2>&1"
  cmd /c $command | Out-Null
  $text = Get-Content -LiteralPath $tmp -Raw -Encoding UTF8
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  foreach ($pattern in $Patterns) {
    if ($text -notmatch [regex]::Escape($pattern)) {
      throw "DOM for $Url does not contain: $pattern"
    }
  }
  Write-Host "PASS $Url"
}

Assert-DomContains "http://127.0.0.1:5177/mobile" @("FabricMind", "generateBtn", "data-mode", "image-drop")
Assert-DomContains "http://127.0.0.1:5177/admin" @("FabricMind", "nav-btn", "metric", "data-nav")
