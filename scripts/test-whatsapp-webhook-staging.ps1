<#
Smoke test do webhook WhatsApp em Supabase Staging.

Uso:
  $env:SUPABASE_URL="https://projeto-staging.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="service_role_staging"
  $env:TEST_LEAD_PHONE="5511900000001"
  $env:TEST_MESSAGE_TEXT="IMV-TESTE-001"
  .\scripts\test-whatsapp-webhook-staging.ps1

Este script simula um payload inbound compativel com whatsapp-webhook-inbound.
Ele deve ser usado somente contra Staging/local, nunca contra Production.
#>

$ErrorActionPreference = "Stop"

function Require-Env($Name) {
  $Value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Defina a variavel de ambiente $Name"
  }
  return $Value
}

$SupabaseUrl = (Require-Env "SUPABASE_URL").TrimEnd("/")
$ServiceRoleKey = Require-Env "SUPABASE_SERVICE_ROLE_KEY"
$LeadPhone = Require-Env "TEST_LEAD_PHONE"
$MessageText = Require-Env "TEST_MESSAGE_TEXT"

if ($SupabaseUrl -match "produc|prod|farollimoveis") {
  throw "SUPABASE_URL parece ser de producao. Este teste deve rodar somente em Staging/local."
}

$WebhookUrl = "$SupabaseUrl/functions/v1/whatsapp-webhook-inbound"
$ExternalId = "staging-smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

$Payload = @{
  EventType = "messages"
  message = @{
    messageid = $ExternalId
    fromMe = $false
    sender_pn = $LeadPhone
    chatid = "$LeadPhone@s.whatsapp.net"
    text = $MessageText
    messageType = "Conversation"
  }
  chat = @{
    wa_chatid = "$LeadPhone@s.whatsapp.net"
  }
  source = "staging-simulated-webhook"
} | ConvertTo-Json -Depth 8

Write-Host "[INFO] Chamando $WebhookUrl"
Write-Host "[INFO] lead_phone=$LeadPhone text=$MessageText external_id=$ExternalId"

$Response = Invoke-WebRequest `
  -Uri $WebhookUrl `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $ServiceRoleKey" } `
  -Body $Payload `
  -UseBasicParsing

Write-Host "[INFO] HTTP $($Response.StatusCode)"
Write-Host $Response.Content

if ($Response.StatusCode -lt 200 -or $Response.StatusCode -ge 300) {
  throw "Webhook retornou HTTP $($Response.StatusCode)"
}

Write-Host "[OK] Payload simulado enviado. Confira webhook_events, whatsapp_messages e bot_interactions no Supabase Staging."
