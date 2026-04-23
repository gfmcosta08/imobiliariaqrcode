#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# test-bot-flow.sh
# Smoke test para o fluxo completo do bot WhatsApp:
#   1. Envia mensagem de QR scan para conversation-handle
#   2. Verifica que mensagens foram enfileiradas no banco
#   3. Chama whatsapp-dispatch diretamente
#   4. Verifica que mensagens foram processadas (status != queued)
#
# Uso:
#   export SUPABASE_URL=https://xxx.supabase.co
#   export SUPABASE_SERVICE_ROLE_KEY=eyJ...
#   export CONVERSATION_HANDLE_URL=https://xxx.supabase.co/functions/v1/conversation-handle
#   export TEST_LEAD_PHONE=5511999990001   # número fictício de teste
#   export TEST_QR_TOKEN=IMV-2026-XXXX    # public_id de um imóvel real no banco
#   bash scripts/test-bot-flow.sh
# -----------------------------------------------------------------------------

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $*"; }

: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"
: "${CONVERSATION_HANDLE_URL:=${SUPABASE_URL}/functions/v1/conversation-handle}"
: "${TEST_LEAD_PHONE:?Set TEST_LEAD_PHONE (digits only, e.g. 5511999990001)}"
: "${TEST_QR_TOKEN:?Set TEST_QR_TOKEN (e.g. IMV-2026-BD5699)}"

DISPATCH_URL="${SUPABASE_URL}/functions/v1/whatsapp-dispatch"
DB_URL="${SUPABASE_URL}/rest/v1/whatsapp_messages"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
APIKEY_HEADER="apikey: ${SUPABASE_SERVICE_ROLE_KEY}"

info "Step 1 – Limpando mensagens de teste antigas do banco..."
curl -s -X DELETE "${DB_URL}?lead_phone=eq.${TEST_LEAD_PHONE}&direction=eq.outbound" \
  -H "${AUTH_HEADER}" -H "${APIKEY_HEADER}" > /dev/null
ok "Mensagens antigas removidas"

info "Step 2 – Enviando mensagem QR scan para conversation-handle..."
HANDLE_RESP=$(curl -s -w "\n%{http_code}" -X POST "${CONVERSATION_HANDLE_URL}" \
  -H "Content-Type: application/json" \
  -H "${AUTH_HEADER}" \
  -d "{\"lead_phone\":\"${TEST_LEAD_PHONE}\",\"text\":\"${TEST_QR_TOKEN}\"}")

HTTP_CODE=$(echo "$HANDLE_RESP" | tail -1)
BODY=$(echo "$HANDLE_RESP" | head -1)

if [ "$HTTP_CODE" != "200" ]; then
  fail "conversation-handle retornou HTTP ${HTTP_CODE}: ${BODY}"
fi

STATE=$(echo "$BODY" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
info "conversation-handle state: ${STATE}"

if [ "$STATE" = "qr_not_found" ]; then
  fail "QR token '${TEST_QR_TOKEN}' não encontrado. Use um public_id válido."
fi

ok "conversation-handle respondeu OK (state=${STATE})"

info "Step 3 – Verificando mensagens enfileiradas no banco..."
sleep 1
QUEUED=$(curl -s "${DB_URL}?lead_phone=eq.${TEST_LEAD_PHONE}&direction=eq.outbound&select=id,status,message_type" \
  -H "${AUTH_HEADER}" -H "${APIKEY_HEADER}" -H "Accept: application/json")

QUEUED_COUNT=$(echo "$QUEUED" | grep -o '"id"' | wc -l | tr -d ' ')
if [ "$QUEUED_COUNT" -eq 0 ]; then
  fail "Nenhuma mensagem enfileirada! O sendPropertyPack falhou silenciosamente."
fi
ok "${QUEUED_COUNT} mensagem(ns) enfileirada(s)"

info "Step 4 – Chamando whatsapp-dispatch..."
DISPATCH_RESP=$(curl -s -w "\n%{http_code}" -X POST "${DISPATCH_URL}" \
  -H "${AUTH_HEADER}")

DISPATCH_CODE=$(echo "$DISPATCH_RESP" | tail -1)
DISPATCH_BODY=$(echo "$DISPATCH_RESP" | head -1)

if [ "$DISPATCH_CODE" = "401" ]; then
  fail "whatsapp-dispatch retornou 401 Unauthorized. Verifique SUPABASE_SERVICE_ROLE_KEY e a lógica de auth do dispatch."
fi

if [ "$DISPATCH_CODE" != "200" ]; then
  fail "whatsapp-dispatch retornou HTTP ${DISPATCH_CODE}: ${DISPATCH_BODY}"
fi

SENT_COUNT=$(echo "$DISPATCH_BODY" | grep -o '"sent":\[[^]]*\]' | grep -o '"[0-9a-f-]*"' | wc -l | tr -d ' ')
FAILED_COUNT=$(echo "$DISPATCH_BODY" | grep -o '"failed":\[[^]]*\]' | grep -o '"id"' | wc -l | tr -d ' ')
ok "dispatch rodou: sent=${SENT_COUNT}, failed=${FAILED_COUNT}"

info "Step 5 – Verificando status final das mensagens..."
sleep 1
FINAL=$(curl -s "${DB_URL}?lead_phone=eq.${TEST_LEAD_PHONE}&direction=eq.outbound&select=id,status" \
  -H "${AUTH_HEADER}" -H "${APIKEY_HEADER}" -H "Accept: application/json")

STILL_QUEUED=$(echo "$FINAL" | grep -o '"status":"queued"' | wc -l | tr -d ' ')
if [ "$STILL_QUEUED" -gt 0 ]; then
  fail "${STILL_QUEUED} mensagem(ns) ainda em status 'queued' após dispatch. Verifique os logs do dispatch no Supabase Dashboard."
fi

ok "Todas as mensagens processadas (nenhuma em 'queued')"

info "Limpando mensagens de teste..."
curl -s -X DELETE "${DB_URL}?lead_phone=eq.${TEST_LEAD_PHONE}&direction=eq.outbound" \
  -H "${AUTH_HEADER}" -H "${APIKEY_HEADER}" > /dev/null

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN} FLUXO DO BOT OK – sem mensagens presas${NC}"
echo -e "${GREEN}================================================${NC}"
