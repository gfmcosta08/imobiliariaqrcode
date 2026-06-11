param(
  [string]$Repository = "gfmcosta08/imobiliariaqrcode",
  [string[]]$Branches = @("main", "master"),
  [string[]]$RequiredContexts = @("CI gate", "Staging readiness gate")
)

$ErrorActionPreference = "Stop"

function Get-GitHubToken {
  if ($env:GH_TOKEN) { return $env:GH_TOKEN }
  if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN }

  $credentialInput = "protocol=https`nhost=github.com`npath=$Repository.git`n`n"
  $credentialLines = $credentialInput | git credential fill
  $token = $credentialLines |
    Where-Object { $_ -like "password=*" } |
    ForEach-Object { $_.Substring("password=".Length) } |
    Select-Object -First 1

  if ($token) { return $token }
  throw "No GitHub token found. Run gh auth login or set GH_TOKEN with repo admin permissions."
}

$token = Get-GitHubToken
$headers = @{
  Authorization          = "Bearer $token"
  Accept                 = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent"           = "ImoveisQR-Staging-Readiness"
}

function Invoke-GitHubJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [object]$Body = $null
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body $json
}

$repo = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/repos/$Repository"
Write-Host "Repository: $($repo.full_name); default branch: $($repo.default_branch); private: $($repo.private)"

$environments = @(
  @{
    name                      = "staging"
    deployment_branch_policy  = $null
  },
  @{
    name                      = "Production"
    deployment_branch_policy  = @{
      protected_branches     = $true
      custom_branch_policies = $false
    }
  }
)

foreach ($environment in $environments) {
  $body = @{
    can_admins_bypass        = $true
    deployment_branch_policy = $environment.deployment_branch_policy
  }

  try {
    $result = Invoke-GitHubJson -Method Put -Uri "https://api.github.com/repos/$Repository/environments/$($environment.name)" -Body $body
    Write-Host "Environment updated: $($environment.name) (id $($result.id))"
  } catch {
    Write-Warning "Could not update environment $($environment.name): $($_.Exception.Message)"
  }
}

$protectionBody = @{
  required_status_checks           = @{
    strict   = $true
    contexts = $RequiredContexts
  }
  enforce_admins                   = $true
  required_pull_request_reviews    = @{
    dismiss_stale_reviews           = $true
    require_code_owner_reviews      = $false
    required_approving_review_count = 1
    require_last_push_approval      = $false
  }
  restrictions                     = $null
  required_linear_history          = $false
  allow_force_pushes               = $false
  allow_deletions                  = $false
  block_creations                  = $false
  required_conversation_resolution = $true
  lock_branch                      = $false
  allow_fork_syncing               = $true
}

foreach ($branch in $Branches) {
  try {
    Invoke-GitHubJson -Method Get -Uri "https://api.github.com/repos/$Repository/branches/$branch" | Out-Null
    $protection = Invoke-GitHubJson -Method Put -Uri "https://api.github.com/repos/$Repository/branches/$branch/protection" -Body $protectionBody
    Write-Host "Branch protection updated: $branch; required contexts: $($protection.required_status_checks.contexts -join ', ')"
  } catch {
    Write-Warning "Could not update branch protection for ${branch}: $($_.Exception.Message)"
  }
}

$summary = foreach ($branch in $Branches) {
  try {
    $protection = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/repos/$Repository/branches/$branch/protection"
    [pscustomobject]@{
      branch                           = $branch
      strict                           = [bool]$protection.required_status_checks.strict
      required_contexts                = $protection.required_status_checks.contexts -join ", "
      enforce_admins                   = [bool]$protection.enforce_admins.enabled
      required_approving_review_count  = $protection.required_pull_request_reviews.required_approving_review_count
      dismiss_stale_reviews            = [bool]$protection.required_pull_request_reviews.dismiss_stale_reviews
      required_conversation_resolution = [bool]$protection.required_conversation_resolution.enabled
      allow_force_pushes               = [bool]$protection.allow_force_pushes.enabled
      allow_deletions                  = [bool]$protection.allow_deletions.enabled
    }
  } catch {
    [pscustomobject]@{
      branch = $branch
      error  = $_.Exception.Message
    }
  }
}

$summary | Format-Table -AutoSize
