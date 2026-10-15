# Hello World for decision models, Windows PowerShell. Nothing to install.
#
#   $env:OPENROUTER_API_KEY = "sk-or-..."
#   powershell -ExecutionPolicy Bypass -File examples/hello-world/hello.ps1
#   powershell -ExecutionPolicy Bypass -File examples/hello-world/hello.ps1 -Model microsoft/microsoft-decision-1-20261009
#
# One request, three questions. Costs about $0.00002. Output tokens are free.
param(
  [string]$Model = "typesafe/jev-1.14",
  [switch]$Raw
)
$ErrorActionPreference = "Stop"
if (-not $env:OPENROUTER_API_KEY) {
  Write-Error 'Set your key first:  $env:OPENROUTER_API_KEY = "sk-or-..."'
}

$body = @{
  model     = $Model
  state     = @("Ticket: Checkout returns HTTP 500 for all users since 10:05.")
  questions = @{
    urgent   = @{
      type         = "noul"
      instructions = "Does this need someone right now?"
      criteria     = @{ "true" = "Customers are blocked or data is at risk"; "false" = "It can wait for normal hours" }
    }
    team     = @{
      type         = "choice"
      instructions = "Which team should own this?"
      criteria     = @{ payments = "Checkout and billing"; auth = "Login and access"; infra = "Servers, network and outages" }
    }
    severity = @{
      type         = "score"
      instructions = "How severe is the impact?"
      criteria     = @("Cosmetic", "Minor", "Major", "Critical")
    }
  }
} | ConvertTo-Json -Depth 6

$watch = [System.Diagnostics.Stopwatch]::StartNew()
$r = Invoke-RestMethod -Method Post -Uri "https://openrouter.ai/api/alpha/decisions" `
  -Headers @{ Authorization = "Bearer $env:OPENROUTER_API_KEY" } `
  -ContentType "application/json" -Body $body
$ms = $watch.ElapsedMilliseconds

if ($Raw) { $r | ConvertTo-Json -Depth 8; return }

$levels = @("Cosmetic", "Minor", "Major", "Critical")
$a = $r.answers
$team = $a.team.probabilities.PSObject.Properties | Sort-Object Value -Descending
$sev = $a.severity.probabilities.PSObject.Properties | Sort-Object Value -Descending | Select-Object -First 1
"model     $($r.model)"
"urgent    yes {0:N2}" -f $a.urgent.noul
"team      {0} {1:N2}   confidence {2:N2}   ({3})" -f $a.team.choice, $a.team.probabilities.($a.team.choice), $a.team.confidence, (($team | ForEach-Object { "{0} {1:N2}" -f $_.Name, $_.Value }) -join ", ")
"severity  {0} {1:N2}   position {2:N2} on 0 to 3" -f $levels[[int]$sev.Name], $sev.Value, $a.severity.score
"cost      `${0:F7} for {1} input tokens (output is free)" -f [double]$r.usage.cost, $r.usage.input_tokens
"time      $ms ms"
