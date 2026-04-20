import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/env.ts";
import { parseManagerCommand } from "../_shared/parser.ts";
import { sendUazapiMessage, verifyWebhookSignature } from "../_shared/uazapi.ts";

const DEFAULT_COMPANY_ID =
  Deno.env.get("DEFAULT_COMPANY_ID") ?? "11111111-1111-1111-1111-111111111111";
const DEFAULT_MANAGER_FALLBACK = Deno.env.get("UAZAPI_INSTANCE_ID") ?? "";
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const CANCEL_KEYWORDS = ["cancelar", "sair", "parar", "encerrar", "0", "cancel", "stop"];

const FULL_DAY_NAMES = [
  "Domingo",
  "Segunda-Feira",
  "Terca-Feira",
  "Quarta-Feira",
  "Quinta-Feira",
  "Sexta-Feira",
  "Sabado",
];

// day_of_week → aliases normalizados (sem acento, lowercase)
const DAY_ALIASES: Array<{ aliases: string[]; dow: number }> = [
  { aliases: ["dom", "domingo"], dow: 0 },
  { aliases: ["seg", "segunda", "segunda-feira"], dow: 1 },
  { aliases: ["ter", "terca", "terca-feira"], dow: 2 },
  { aliases: ["qua", "quarta", "quarta-feira"], dow: 3 },
  { aliases: ["qui", "quinta", "quinta-feira"], dow: 4 },
  { aliases: ["sex", "sexta", "sexta-feira"], dow: 5 },
  { aliases: ["sab", "sabado"], dow: 6 },
];

type SessionState =
  | "idle"
  | "selecting_service"
  | "selecting_slot"
  | "confirming_slot"
  | "confirming_suggestion"
  | "manager_pending"
  | "manager_suggesting"
  | "manager_encaixar";
type DaySlots = { dow: number; date: string; dayName: string; ddMm: string; times: string[] };
type SessionData = {
  service_id?: string;
  service_name?: string;
  available_days?: DaySlots[];
  pending_date?: string;
  pending_time?: string;
  pending_label?: string;
  // contexto de sugestão/encaixe do gestor (lado do cliente)
  appointment_id?: string;
  is_encaixe?: boolean;
  // manager context
  mgr_appointment_id?: string;
  mgr_customer_name?: string;
  mgr_customer_phone?: string;
  mgr_time?: string;
  mgr_date?: string;
  mgr_service_name?: string;
  mgr_available_days?: DaySlots[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const isValid = await verifyWebhookSignature(rawBody, req.headers.get("x-uazapi-signature"));
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const origin = detectOriginContext(payload);

    if (origin.isGroupLike) {
      const supabase = getServiceClient();
      await supabase.from("audit_logs").insert({
        action: "whatsapp.group_ignored",
        payload: {
          reason: "group_origin_blocked",
          raw_from: origin.rawFrom,
          raw_jid: origin.rawJid,
          message_id: origin.messageId || null,
        },
      });
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: "group_origin_blocked",
        mode: "ignored_group",
      });
    }

    const from = origin.from;
    const to = origin.to;
    const text = origin.text;
    const messageId = origin.messageId;

    if (!from || !text)
      return jsonResponse({ ok: true, ignored: true, reason: "missing_from_or_text" });

    // Anti-loop: mensagens fromMe que são respostas do bot sempre contêm "*" (bold), "\n", ou são longas.
    // Entradas do gestor (atalhos, horários, nomes de dia) são curtas e sem formatação.
    if (origin.isFromMe && (text.includes("*") || text.includes("\n") || text.length > 70)) {
      return jsonResponse({ ok: true, ignored: true, reason: "bot_own_response" });
    }

    const supabase = getServiceClient();

    const { error: insertError } = await supabase.from("whatsapp_messages").insert({
      company_id: DEFAULT_COMPANY_ID,
      from_number: from,
      to_number: to,
      message: text,
      type: "inbound",
      raw_payload: payload,
      external_id: messageId || null,
    });

    if (insertError) {
      if (insertError.code === "23505")
        return jsonResponse({ ok: true, ignored: true, reason: "duplicate" });
      return jsonResponse({ error: insertError.message }, 500);
    }

    const { data: botSettings } = await supabase
      .from("bot_settings")
      .select("bot_phone, manager_phone, auto_confirm, fallback_message, welcome_message")
      .eq("company_id", DEFAULT_COMPANY_ID)
      .single();

    const managerPhone =
      botSettings?.manager_phone?.trim() ||
      botSettings?.bot_phone?.trim() ||
      normalizePhone(to) ||
      DEFAULT_MANAGER_FALLBACK;
    const isManager =
      managerPhone.length > 0 && normalizePhone(managerPhone) === normalizePhone(from);
    const normalizedText = normalizeText(text);

    if (isManager) {
      const mgrSession = await getSession(supabase, from);
      const mgrData = mgrSession.data as SessionData;

      // ── Gestor escolhendo horario para sugerir ao cliente ─────────────────
      if (mgrSession.state === "manager_suggesting") {
        const days = mgrData.mgr_available_days ?? [];
        const parsed = parseSlotInput(normalizedText, days);
        if (
          parsed &&
          mgrData.mgr_appointment_id &&
          mgrData.mgr_customer_phone &&
          mgrData.mgr_customer_name
        ) {
          const [, mm, dd] = parsed.date.split("-");
          await sendUazapiMessage({
            to: mgrData.mgr_customer_phone,
            message: `Ola! Temos uma sugestao de horario para *${mgrData.mgr_service_name ?? "seu servico"}*:\n*${dd}/${mm} as ${parsed.time}*\n\nResponda *sim* para aceitar ou *nao* para escolher outro horario.`,
          });
          await supabase
            .from("appointments")
            .update({ status: "pending" })
            .eq("id", mgrData.mgr_appointment_id);
          // Setar sessão do CLIENTE para aguardar "sim/nao" à sugestão
          await setSession(supabase, mgrData.mgr_customer_phone, "confirming_suggestion", {
            appointment_id: mgrData.mgr_appointment_id,
            service_name: mgrData.mgr_service_name,
            pending_date: parsed.date,
            pending_time: parsed.time,
          });
          await clearSession(supabase, from);
          await logOutbound(
            supabase,
            `Sugestao *${dd}/${mm} ${parsed.time}* enviada para ${mgrData.mgr_customer_name}.`,
            from,
            to,
            payload,
          );
        } else {
          await logOutbound(
            supabase,
            "Horario invalido. Envie no formato *dd/mm HH:MM* ou nome do dia + hora.\nOu *cancelar* para sair.",
            from,
            to,
            payload,
          );
        }
        return jsonResponse({ ok: true, mode: "manager_suggesting" });
      }

      // ── Gestor encaixando cliente em horario ──────────────────────────────
      if (mgrSession.state === "manager_encaixar") {
        const days = mgrData.mgr_available_days ?? [];
        const parsed = parseFreeSlotInput(normalizedText, days);
        if (
          parsed &&
          mgrData.mgr_appointment_id &&
          mgrData.mgr_customer_phone &&
          mgrData.mgr_customer_name
        ) {
          const [, mm, dd] = parsed.date.split("-");
          // Envia proposta ao cliente — ele confirma antes de ser efetivado
          await sendUazapiMessage({
            to: mgrData.mgr_customer_phone,
            message: `Ola! Temos um horario para *${mgrData.mgr_service_name ?? "seu servico"}*:\n*${dd}/${mm} as ${parsed.time}*\n\nResponda *sim* para confirmar ou *nao* para recusar.`,
          });
          await setSession(supabase, mgrData.mgr_customer_phone, "confirming_suggestion", {
            appointment_id: mgrData.mgr_appointment_id,
            service_name: mgrData.mgr_service_name,
            pending_date: parsed.date,
            pending_time: parsed.time,
            is_encaixe: true,
          });
          await clearSession(supabase, from);
          await logOutbound(
            supabase,
            `Encaixe *${dd}/${mm} ${parsed.time}* enviado para ${mgrData.mgr_customer_name} confirmar.`,
            from,
            to,
            payload,
          );
        } else {
          await logOutbound(
            supabase,
            "Horario invalido. Informe o dia e horario.\nEx: _quinta 14h30_, _10/04 15:00_\nOu *cancelar* para sair.",
            from,
            to,
            payload,
          );
        }
        return jsonResponse({ ok: true, mode: "manager_encaixar" });
      }

      // ── Gestor usando atalho numerico (5/6/7/8) ───────────────────────────
      if (mgrSession.state === "manager_pending" && ["5", "6", "7", "8"].includes(normalizedText)) {
        const appId = mgrData.mgr_appointment_id;
        const custPhone = mgrData.mgr_customer_phone ?? "";
        const custName = mgrData.mgr_customer_name ?? "Cliente";
        const mgrTime = mgrData.mgr_time ?? "";
        const mgrDate = mgrData.mgr_date ?? "";

        if (normalizedText === "5" && appId) {
          // Confirmar
          await supabase.from("appointments").update({ status: "confirmed" }).eq("id", appId);
          await supabase.from("contact_queue").insert({
            company_id: DEFAULT_COMPANY_ID,
            name: custName,
            phone: custPhone,
            source: "whatsapp",
            appointment_id: appId,
            requested_service: mgrData.mgr_service_name ?? "",
            requested_time: `${mgrDate} ${mgrTime}`,
            status: "converted",
          });
          if (custPhone) {
            const [, mm, dd] = mgrDate.split("-");
            try {
              await sendUazapiMessage({
                to: custPhone,
                message: `Seu agendamento das *${mgrTime}* do dia *${dd}/${mm}* foi *confirmado!* Ate breve.`,
              });
            } catch {
              /* nao falhar */
            }
          }
          await clearSession(supabase, from);
          await logOutbound(
            supabase,
            `Agendamento de *${custName}* confirmado.`,
            from,
            to,
            payload,
          );
        } else if (normalizedText === "6" && appId) {
          // Sugerir - mostrar slots
          const days = await getAvailableDays(supabase);
          if (!days.length) {
            await logOutbound(supabase, "Nenhum horario disponivel no momento.", from, to, payload);
          } else {
            await setSession(supabase, from, "manager_suggesting", {
              ...mgrData,
              mgr_available_days: days,
            });
            const slotsMsg = `Escolha um horario para sugerir a *${custName}*:\n\n${buildSlotsMessage(mgrData.mgr_service_name ?? "Servico", days)}`;
            await logOutbound(supabase, slotsMsg, from, to, payload);
          }
        } else if (normalizedText === "7" && appId) {
          // Cancelar
          await supabase.from("appointments").update({ status: "canceled" }).eq("id", appId);
          if (custPhone) {
            try {
              await sendUazapiMessage({
                to: custPhone,
                message:
                  "Seu agendamento pendente foi cancelado. Aguarde contato para novo horario.",
              });
            } catch {
              /* nao falhar */
            }
          }
          await clearSession(supabase, from);
          await logOutbound(supabase, `Agendamento de *${custName}* cancelado.`, from, to, payload);
        } else if (normalizedText === "8" && appId) {
          // Encaixar - qualquer horario, inclusive fora dos disponiveis
          const days = await getAvailableDays(supabase);
          await setSession(supabase, from, "manager_encaixar", {
            ...mgrData,
            mgr_available_days: days,
          });
          const encaixeHeader = `Encaixe para *${custName}*. Informe o dia e horario (qualquer horario, inclusive ja reservado):`;
          const slotsMsg =
            days.length > 0
              ? `${encaixeHeader}\n\n${buildSlotsMessage(mgrData.mgr_service_name ?? "Servico", days)}\n_Voce pode usar qualquer horario, inclusive fora dos listados._`
              : `${encaixeHeader}\nEx: _quinta 14h30_, _10/04 15:00_`;
          await logOutbound(supabase, slotsMsg, from, to, payload);
        }

        return jsonResponse({ ok: true, mode: "manager_shortcut" });
      }

      // ── Comandos de texto do gestor (fallback) ────────────────────────────
      const command = parseManagerCommand(text);
      const commandResponse = await processManagerCommand(supabase, command, from);
      await logOutbound(supabase, commandResponse, from, to, payload);
      return jsonResponse({ ok: true, mode: "manager" });
    }

    if (CANCEL_KEYWORDS.includes(normalizedText)) {
      await clearSession(supabase, from);
      await logOutbound(
        supabase,
        "Atendimento encerrado. Digite *oi* para iniciar novamente.",
        from,
        to,
        payload,
      );
      return jsonResponse({ ok: true, mode: "cancel" });
    }

    const session = await getSession(supabase, from);

    if (session.state !== "idle") {
      const elapsed = Date.now() - new Date(session.updated_at).getTime();
      if (elapsed > SESSION_TIMEOUT_MS) {
        await clearSession(supabase, from);
        const welcome = botSettings?.welcome_message ?? "Ola! Digite *oi* para iniciar.";
        await logOutbound(
          supabase,
          `Sua sessao expirou por inatividade.\n\n${welcome}`,
          from,
          to,
          payload,
        );
        return jsonResponse({ ok: true, mode: "timeout_reset" });
      }
    }

    // ── Confirmando sugestão de horário do gestor ─────────────────────────
    if (session.state === "confirming_suggestion") {
      const d = session.data as SessionData;

      if (["sim", "s", "confirmar", "ok", "yes"].includes(normalizedText)) {
        // Confirma o agendamento existente com data/hora sugerida pelo gestor
        await supabase
          .from("appointments")
          .update({ status: "confirmed", date: d.pending_date!, time: d.pending_time! })
          .eq("id", d.appointment_id!);
        await supabase.from("contact_queue").insert({
          company_id: DEFAULT_COMPANY_ID,
          name: `Cliente ${from.slice(-4)}`,
          phone: from,
          source: "whatsapp",
          appointment_id: d.appointment_id,
          requested_service: d.service_name ?? "",
          requested_time: `${d.pending_date} ${d.pending_time}`,
          status: "converted",
        });
        const [, mm, dd] = d.pending_date!.split("-");
        await clearSession(supabase, from);
        await logOutbound(
          supabase,
          `Seu agendamento das *${d.pending_time}* do dia *${dd}/${mm}* foi *confirmado!* Ate breve.`,
          from,
          to,
          payload,
        );
        return jsonResponse({ ok: true, mode: "suggestion_confirmed" });
      }

      if (["nao", "n", "outro", "nao quero", "mudar"].includes(normalizedText)) {
        await supabase
          .from("appointments")
          .update({ status: "canceled" })
          .eq("id", d.appointment_id!);
        if (d.is_encaixe) {
          // Encaixe recusado: não reinicia fluxo de seleção
          await clearSession(supabase, from);
          await logOutbound(
            supabase,
            "Entendido. Se quiser agendar, envie *oi* para iniciar novamente.",
            from,
            to,
            payload,
          );
          return jsonResponse({ ok: true, mode: "encaixe_rejected" });
        }
        // Sugestão recusada: reinicia seleção de horário
        const { data: appt } = await supabase
          .from("appointments")
          .select("service_id")
          .eq("id", d.appointment_id!)
          .single();
        const availableDays = await getAvailableDays(supabase);
        if (!availableDays.length) {
          await clearSession(supabase, from);
          await logOutbound(
            supabase,
            "Sem horarios disponiveis no momento. Entre em contato para agendar.",
            from,
            to,
            payload,
          );
          return jsonResponse({ ok: true, mode: "no_slots_after_rejection" });
        }
        await setSession(supabase, from, "selecting_slot", {
          service_id: appt?.service_id,
          service_name: d.service_name,
          available_days: availableDays,
        });
        await logOutbound(
          supabase,
          buildSlotsMessage(d.service_name ?? "Servico", availableDays),
          from,
          to,
          payload,
        );
        return jsonResponse({ ok: true, mode: "suggestion_rejected_reselect" });
      }

      const [, mm2, dd2] = (d.pending_date ?? "2000-01-01").split("-");
      await logOutbound(
        supabase,
        `Responda *sim* para confirmar *${dd2}/${mm2} as ${d.pending_time}* ou *nao* para escolher outro horario.`,
        from,
        to,
        payload,
      );
      return jsonResponse({ ok: true, mode: "confirming_suggestion_prompt" });
    }

    // ── Confirmando agendamento ────────────────────────────────────────────
    if (session.state === "confirming_slot") {
      const d = session.data as SessionData;

      if (["sim", "s", "confirmar", "ok", "yes"].includes(normalizedText)) {
        const bookingResult = await createBooking(supabase, {
          serviceId: d.service_id!,
          serviceName: d.service_name!,
          customerPhone: from,
          date: d.pending_date!,
          time: d.pending_time!,
          autoConfirm: botSettings?.auto_confirm ?? false,
          companyId: DEFAULT_COMPANY_ID,
          managerPhone: managerPhone,
          botPhone: botSettings?.bot_phone?.trim() ?? "",
        });

        if (bookingResult.ok) {
          await clearSession(supabase, from);
          await logOutbound(supabase, bookingResult.message, from, to, payload);
          return jsonResponse({ ok: true, mode: "booked" });
        }

        const refreshedDays = await getAvailableDays(supabase);
        if (!refreshedDays.length) {
          await clearSession(supabase, from);
          await logOutbound(
            supabase,
            `${bookingResult.message}\n\nNo momento nao ha mais horarios disponiveis. Digite *oi* para reiniciar.`,
            from,
            to,
            payload,
          );
          return jsonResponse({ ok: true, mode: "booking_failed_no_slots" });
        }

        await setSession(supabase, from, "selecting_slot", {
          service_id: d.service_id,
          service_name: d.service_name,
          available_days: refreshedDays,
        });
        const retryMsg = `${bookingResult.message}\n\n${buildSlotsMessage(d.service_name!, refreshedDays)}`;
        await logOutbound(supabase, retryMsg, from, to, payload);
        return jsonResponse({ ok: true, mode: "booking_failed_retry" });
      }

      if (["nao", "n", "outro", "nao quero", "mudar"].includes(normalizedText)) {
        // Volta para seleção de horário
        await setSession(supabase, from, "selecting_slot", {
          service_id: d.service_id,
          service_name: d.service_name,
          available_days: d.available_days,
        });
        const msg = buildSlotsMessage(d.service_name!, d.available_days!);
        await logOutbound(supabase, msg, from, to, payload);
        return jsonResponse({ ok: true, mode: "back_to_slots" });
      }

      await logOutbound(
        supabase,
        "Responda *sim* para confirmar ou *nao* para escolher outro horario.",
        from,
        to,
        payload,
      );
      return jsonResponse({ ok: true, mode: "confirm_prompt" });
    }

    // ── Selecionando horário ───────────────────────────────────────────────
    if (session.state === "selecting_slot") {
      const d = session.data as SessionData;
      const availableDays = d.available_days ?? [];
      const parsed = parseSlotInput(normalizedText, availableDays);

      if (!parsed) {
        const msg =
          "Nao entendi o horario. Tente ex: *seg as 8*, *terca 9h*, *06/04 08:00*\nOu *cancelar* para sair.";
        await logOutbound(supabase, msg, from, to, payload);
        return jsonResponse({ ok: true, mode: "invalid_slot" });
      }

      // Pede confirmação
      await setSession(supabase, from, "confirming_slot", {
        ...d,
        pending_date: parsed.date,
        pending_time: parsed.time,
        pending_label: parsed.label,
      });

      const confirmMsg =
        `Confirmacao:\n` +
        `Servico: *${d.service_name}*\n` +
        `Data: *${parsed.label}*\n\n` +
        `Responda *sim* para confirmar ou *nao* para escolher outro horario.`;

      await logOutbound(supabase, confirmMsg, from, to, payload);
      return jsonResponse({ ok: true, mode: "confirm_prompt" });
    }

    // ── Selecionando serviço ───────────────────────────────────────────────
    if (session.state === "selecting_service") {
      const serviceNumber = parseInt(normalizedText, 10);

      if (!isNaN(serviceNumber) && serviceNumber > 0) {
        const { data: service } = await supabase
          .from("services")
          .select("id, name")
          .eq("company_id", DEFAULT_COMPANY_ID)
          .eq("number", serviceNumber)
          .eq("active", true)
          .maybeSingle();

        if (service) {
          const availableDays = await getAvailableDays(supabase);

          if (availableDays.length === 0) {
            await clearSession(supabase, from);
            await logOutbound(
              supabase,
              "Nenhum horario disponivel no momento. Contate o gestor.",
              from,
              to,
              payload,
            );
            return jsonResponse({ ok: true, mode: "no_slots" });
          }

          await setSession(supabase, from, "selecting_slot", {
            service_id: service.id,
            service_name: service.name,
            available_days: availableDays,
          });

          const msg = buildSlotsMessage(service.name, availableDays);
          await logOutbound(supabase, msg, from, to, payload);
          return jsonResponse({ ok: true, mode: "slot_list" });
        }
      }

      await logOutbound(
        supabase,
        "Opcao invalida. Digite o numero do servico ou *cancelar* para voltar.",
        from,
        to,
        payload,
      );
      return jsonResponse({ ok: true, mode: "invalid_service" });
    }

    // ── Idle ───────────────────────────────────────────────────────────────
    // Atalhos rapidos (so funcionam em idle)
    if (normalizedText === "1" || normalizedText === "agendar") {
      const serviceList = await listServices(supabase);
      await setSession(supabase, from, "selecting_service", {});
      await logOutbound(supabase, serviceList, from, to, payload);
      return jsonResponse({ ok: true, mode: "service_list" });
    }

    if (
      normalizedText === "2" ||
      normalizedText === "servicos" ||
      normalizedText === "ver servicos"
    ) {
      const { data: services } = await supabase
        .from("services")
        .select("number, name, price, description")
        .eq("company_id", DEFAULT_COMPANY_ID)
        .eq("active", true)
        .order("number", { ascending: true });

      if (!services || services.length === 0) {
        await logOutbound(supabase, "Nenhum servico disponivel no momento.", from, to, payload);
      } else {
        const lines = services.map((s) => {
          const desc = s.description ? ` — ${s.description}` : "";
          return `*${s.number}.* ${s.name} — R$ ${Number(s.price).toFixed(2)}${desc}`;
        });
        await setSession(supabase, from, "selecting_service", {});
        const msg = `*Nossos Servicos:*\n${lines.join("\n")}\n\nDigite o *numero do servico* para continuar ou *cancelar* para voltar.`;
        await logOutbound(supabase, msg, from, to, payload);
      }
      return jsonResponse({ ok: true, mode: "services_info" });
    }

    if (normalizedText === "3") {
      // Inserir na fila do dashboard como solicitação de atendimento humano
      await supabase.from("contact_queue").insert({
        company_id: DEFAULT_COMPANY_ID,
        name: `Cliente ${from.slice(-4)}`,
        phone: from,
        source: "whatsapp",
        requested_service: "Contato com responsavel",
        status: "new",
      });
      // Notificar bot_phone + manager_phone (se diferente)
      const notifyMsg =
        `*Solicitacao de atendimento humano*\n` +
        `Cliente: ${from}\n` +
        `Quer falar com um responsavel.`;
      const rawBotPhone = botSettings?.bot_phone?.trim() ?? "";
      const rawManagerPhone = botSettings?.manager_phone?.trim() || null;
      try {
        await notifyStaff(notifyMsg, rawBotPhone, rawManagerPhone);
      } catch {
        /* nao falhar */
      }
      await logOutbound(
        supabase,
        "Sua solicitacao foi encaminhada. Em breve um responsavel entrara em contato.",
        from,
        to,
        payload,
      );
      return jsonResponse({ ok: true, mode: "contact_request" });
    }

    if (normalizedText === "4") {
      await clearSession(supabase, from);
      await logOutbound(
        supabase,
        "Atendimento encerrado. Digite *oi* para iniciar novamente.",
        from,
        to,
        payload,
      );
      return jsonResponse({ ok: true, mode: "end" });
    }

    // Qualquer outra mensagem em idle (oi, bom dia, boa noite, boa tarde, etc.)
    // sempre responde com a mensagem de boas-vindas programada
    await clearSession(supabase, from);
    const welcome = botSettings?.welcome_message ?? "Ola! Como posso ajudar?";
    await logOutbound(supabase, welcome, from, to, payload);
    return jsonResponse({ ok: true, mode: "welcome" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: String(error) }, 500);
  }
});

// ── Horários ─────────────────────────────────────────────────────────────────

async function getAvailableDays(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<DaySlots[]> {
  const { data: days } = await supabase
    .from("available_days")
    .select("id, day_of_week")
    .eq("company_id", DEFAULT_COMPANY_ID)
    .eq("active", true);

  if (!days || days.length === 0) return [];

  const { data: slots } = await supabase
    .from("available_time_slots")
    .select("day_id, time")
    .in(
      "day_id",
      days.map((d) => d.id),
    )
    .eq("active", true)
    .order("time", { ascending: true });

  if (!slots || slots.length === 0) return [];

  const slotsByDow = new Map<number, string[]>();
  for (const day of days) {
    const times = slots.filter((s) => s.day_id === day.id).map((s) => s.time.slice(0, 5));
    if (times.length > 0) slotsByDow.set(day.day_of_week, times);
  }

  const now = new Date();
  // Hora atual em BRT (UTC-3)
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayHHMM = `${String(brtNow.getHours()).padStart(2, "0")}:${String(brtNow.getMinutes()).padStart(2, "0")}`;

  // Datas do range a verificar
  const startDate = brtNow.toISOString().slice(0, 10);
  const endD = new Date(brtNow);
  endD.setDate(brtNow.getDate() + 30);
  const endDate = endD.toISOString().slice(0, 10);

  // Buscar agendamentos ocupados (pending, confirmed ou reschedule)
  const { data: booked } = await supabase
    .from("appointments")
    .select("date, time")
    .eq("company_id", DEFAULT_COMPANY_ID)
    .in("status", ["pending", "confirmed", "reschedule"])
    .gte("date", startDate)
    .lte("date", endDate);

  const bookedMap = new Map<string, Set<string>>();
  for (const b of booked ?? []) {
    const key = String(b.date);
    const t = String(b.time).slice(0, 5);
    if (!bookedMap.has(key)) bookedMap.set(key, new Set<string>());
    bookedMap.get(key)!.add(t);
  }

  const result: DaySlots[] = [];

  for (let i = 0; i <= 30 && result.length < 5; i++) {
    const d = new Date(brtNow);
    d.setDate(brtNow.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay();

    let times = slotsByDow.get(dow);
    if (!times || times.length === 0) continue;

    // Hoje: filtrar horários que já passaram
    if (i === 0) {
      times = times.filter((t) => t > todayHHMM);
      if (times.length === 0) continue;
    }

    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayBooked = bookedMap.get(dateStr) ?? new Set<string>();
    times = times.filter((t) => !dayBooked.has(t));
    if (times.length === 0) continue;

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");

    result.push({ dow, date: dateStr, dayName: FULL_DAY_NAMES[dow], ddMm: `${dd}/${mm}`, times });
  }

  return result;
}

function buildSlotsMessage(serviceName: string, days: DaySlots[]): string {
  const lines = days.map((d) => `*${d.dayName} ${d.ddMm}:* ${d.times.join(", ")}`);
  return (
    `Servico: *${serviceName}*\n\n` +
    `Horarios disponiveis:\n${lines.join("\n")}\n\n` +
    `Responda com o dia e horario. Ex:\n` +
    `_seg as 8_, _terca 9h_, _${days[0]?.ddMm ?? "06/04"} 08:00_\n\n` +
    `Ou *cancelar* para voltar.`
  );
}

// ── Parser de horário em linguagem natural ────────────────────────────────────

function parseSlotInput(
  text: string,
  days: DaySlots[],
): { date: string; time: string; label: string } | null {
  // Tenta data no formato DD/MM
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  let matchedDay: DaySlots | null = null;

  if (dateMatch) {
    const dd = dateMatch[1].padStart(2, "0");
    const mm = dateMatch[2].padStart(2, "0");
    matchedDay = days.find((d) => d.ddMm === `${dd}/${mm}`) ?? null;
  }

  // Tenta nome do dia
  if (!matchedDay) {
    for (const { aliases, dow } of DAY_ALIASES) {
      if (aliases.some((a) => text.includes(a))) {
        matchedDay = days.find((d) => d.dow === dow) ?? null;
        if (matchedDay) break;
      }
    }
  }

  if (!matchedDay) return null;

  // Extrai hora do texto: "8", "8h", "8:00", "08:00", "8h30", "800"
  const timeMatch = text.match(/(\d{1,2})[h:]?(\d{2})?(?:\s|$|h)/i) ?? text.match(/(\d{1,2})/);
  if (!timeMatch) return null;

  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2] ?? "0", 10);
  if (isNaN(hours) || hours < 0 || hours > 23) return null;

  const hh = String(hours).padStart(2, "0");
  const mn = String(minutes).padStart(2, "0");
  const timeStr = `${hh}:${mn}`;

  // Busca o horário mais próximo disponível naquele dia
  const matchedTime =
    matchedDay.times.find((t) => t === timeStr) ??
    matchedDay.times.find((t) => t.startsWith(`${hh}:`));

  if (!matchedTime) return null;

  return {
    date: matchedDay.date,
    time: matchedTime,
    label: `${matchedDay.dayName} ${matchedDay.ddMm} as ${matchedTime}`,
  };
}

// ── Parser livre para encaixe (aceita qualquer horário) ──────────────────────

function getBrtToday(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T00:00:00`);
}

function parseFreeSlotInput(
  text: string,
  days: DaySlots[],
): { date: string; time: string; label: string } | null {
  let matchedDate: string | null = null;
  let matchedDayName = "";
  let ddMm = "";

  // Tenta DD/MM — primeiro nos dias disponíveis, depois calcula
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (dateMatch) {
    const dd = dateMatch[1].padStart(2, "0");
    const mm = dateMatch[2].padStart(2, "0");
    const inDays = days.find((d) => d.ddMm === `${dd}/${mm}`);
    if (inDays) {
      matchedDate = inDays.date;
      matchedDayName = inDays.dayName;
      ddMm = inDays.ddMm;
    } else {
      const today = getBrtToday();
      const year = today.getFullYear();
      const candidate = new Date(`${year}-${mm}-${dd}T12:00:00`);
      if (candidate < today) candidate.setFullYear(year + 1);
      const dy = String(candidate.getDate()).padStart(2, "0");
      const mo = String(candidate.getMonth() + 1).padStart(2, "0");
      matchedDate = `${candidate.getFullYear()}-${mo}-${dy}`;
      matchedDayName = FULL_DAY_NAMES[candidate.getDay()];
      ddMm = `${dy}/${mo}`;
    }
  }

  // Tenta nome do dia — primeiro nos disponíveis, depois próxima ocorrência
  if (!matchedDate) {
    for (const { aliases, dow } of DAY_ALIASES) {
      if (aliases.some((a) => text.includes(a))) {
        const inDays = days.find((d) => d.dow === dow);
        if (inDays) {
          matchedDate = inDays.date;
          matchedDayName = inDays.dayName;
          ddMm = inDays.ddMm;
        } else {
          const today = getBrtToday();
          let daysUntil = (dow - today.getDay() + 7) % 7;
          if (daysUntil === 0) daysUntil = 7;
          const target = new Date(today);
          target.setDate(today.getDate() + daysUntil);
          const dy = String(target.getDate()).padStart(2, "0");
          const mo = String(target.getMonth() + 1).padStart(2, "0");
          matchedDate = `${target.getFullYear()}-${mo}-${dy}`;
          matchedDayName = FULL_DAY_NAMES[dow];
          ddMm = `${dy}/${mo}`;
        }
        break;
      }
    }
  }

  if (!matchedDate) return null;

  // Extrai horário — aceita qualquer HH:MM, HHhMM, HHh ou número solto
  const timeMatch =
    text.match(/(\d{1,2})[h:](\d{2})/) ?? // "14:30", "14h30"
    text.match(/(\d{1,2})h\b/i) ?? // "14h"
    text.match(/(\d{1,2})/); // "14" (número solto)

  if (!timeMatch) return null;

  const hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  if (isNaN(hours) || hours < 0 || hours > 23) return null;
  if (isNaN(minutes) || minutes < 0 || minutes > 59) return null;

  const hh = String(hours).padStart(2, "0");
  const mn = String(minutes).padStart(2, "0");
  return {
    date: matchedDate,
    time: `${hh}:${mn}`,
    label: `${matchedDayName} ${ddMm} as ${hh}:${mn}`,
  };
}

// ── Serviços ─────────────────────────────────────────────────────────────────

async function listServices(supabase: ReturnType<typeof getServiceClient>): Promise<string> {
  const { data } = await supabase
    .from("services")
    .select("number, name, price")
    .eq("company_id", DEFAULT_COMPANY_ID)
    .eq("active", true)
    .order("number", { ascending: true });

  if (!data || data.length === 0) return "Nenhum servico disponivel no momento.";

  const items = data.map((s) => `${s.number} - ${s.name} (R$ ${Number(s.price).toFixed(2)})`);
  return `Escolha o servico:\n${items.join("\n")}\n\nOu *cancelar* para voltar.`;
}

// ── Agendamento ──────────────────────────────────────────────────────────────

async function createBooking(
  supabase: ReturnType<typeof getServiceClient>,
  params: {
    serviceId: string;
    serviceName: string;
    customerPhone: string;
    date: string;
    time: string;
    autoConfirm: boolean;
    companyId: string;
    managerPhone: string;
    botPhone: string;
  },
): Promise<{ ok: boolean; message: string }> {
  const customerName = `Cliente ${params.customerPhone.slice(-4)}`;

  const { data: customerData, error: customerError } = await supabase.rpc(
    "find_or_create_customer",
    {
      p_company_id: params.companyId,
      p_name: customerName,
      p_phone: params.customerPhone,
      p_email: null,
    },
  );

  if (customerError) throw customerError;

  const { data: insertedAppointment, error } = await supabase
    .from("appointments")
    .insert({
      company_id: params.companyId,
      customer_id: customerData.id,
      service_id: params.serviceId,
      date: params.date,
      time: params.time,
      status: params.autoConfirm ? "confirmed" : "pending",
      source: "whatsapp",
      auto_confirmed: params.autoConfirm,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.from("audit_logs").insert({
      action: "whatsapp.booking.error",
      payload: {
        code: error.code ?? null,
        message: error.message ?? "unknown",
        details: error.details ?? null,
        hint: error.hint ?? null,
        company_id: params.companyId,
        service_id: params.serviceId,
        customer_phone: params.customerPhone,
        date: params.date,
        time: params.time,
      },
    });

    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "Esse horario acabou de ser reservado por outra pessoa. Escolha outro horario para continuar.",
      };
    }

    return {
      ok: false,
      message: "Erro ao criar agendamento. Tente novamente ou contate o gestor.",
    };
  }

  // Notificar gestor se nao for auto-confirmado
  if (!params.autoConfirm && params.managerPhone) {
    const [, mm, dd] = params.date.split("-");
    const dateLabel = `${dd}/${mm} as ${params.time}`;
    const managerMsg =
      `*Novo agendamento pendente!*\n` +
      `Cliente: *${customerName}*\n` +
      `Telefone: ${params.customerPhone}\n` +
      `Servico: ${params.serviceName}\n` +
      `Data: ${dateLabel}\n\n` +
      `Responda:\n` +
      `*5* - Confirmar\n` +
      `*6* - Sugerir outro horario\n` +
      `*7* - Cancelar\n` +
      `*8* - Encaixar`;
    // Salvar contexto na sessao do gestor para atalhos numericos funcionarem
    await setSession(supabase, params.managerPhone, "manager_pending", {
      mgr_appointment_id: insertedAppointment?.id ?? "",
      mgr_customer_name: customerName,
      mgr_customer_phone: params.customerPhone,
      mgr_time: params.time,
      mgr_date: params.date,
      mgr_service_name: params.serviceName,
    });
    try {
      await notifyStaff(managerMsg, params.botPhone, params.managerPhone);
    } catch (notifyErr) {
      console.error("[createBooking] falha ao notificar gestor:", notifyErr);
      await supabase.from("audit_logs").insert({
        action: "whatsapp.booking.notify_failed",
        payload: {
          appointment_id: insertedAppointment?.id ?? null,
          manager_phone: params.managerPhone,
          error: String(notifyErr),
        },
      });
    }
  } else if (!params.autoConfirm && !params.managerPhone) {
    await supabase.from("audit_logs").insert({
      action: "whatsapp.booking.no_manager_phone",
      payload: {
        appointment_id: insertedAppointment?.id ?? null,
        customer_phone: params.customerPhone,
      },
    });
  }

  // Só cria entry na fila quando confirmado; pendencias ficam apenas em appointments
  if (params.autoConfirm) {
    await supabase.from("contact_queue").insert({
      company_id: params.companyId,
      name: customerName,
      phone: params.customerPhone,
      source: "whatsapp",
      appointment_id: insertedAppointment?.id ?? null,
      requested_service: params.serviceName,
      requested_time: `${params.date} ${params.time}`,
      status: "converted",
    });
  }

  const [, mm, dd] = params.date.split("-");
  const label = `${dd}/${mm} as ${params.time}`;

  if (params.autoConfirm) {
    return {
      ok: true,
      message: `Agendamento confirmado!\nServico: *${params.serviceName}*\nData: *${label}*\n\nDigite *oi* para novo atendimento.`,
    };
  }
  return {
    ok: true,
    message: `Pedido recebido!\nServico: *${params.serviceName}*\nData sugerida: *${label}*\n\nAguarde a confirmacao do gestor. Digite *oi* para novo atendimento.`,
  };
}

// ── Sessão ────────────────────────────────────────────────────────────────────

async function getSession(supabase: ReturnType<typeof getServiceClient>, phone: string) {
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("state, data, updated_at")
    .eq("company_id", DEFAULT_COMPANY_ID)
    .eq("phone", phone)
    .maybeSingle();
  return data ?? { state: "idle" as SessionState, data: {}, updated_at: new Date().toISOString() };
}

async function setSession(
  supabase: ReturnType<typeof getServiceClient>,
  phone: string,
  state: SessionState,
  data: SessionData,
) {
  await supabase
    .from("whatsapp_sessions")
    .upsert(
      { company_id: DEFAULT_COMPANY_ID, phone, state, data, updated_at: new Date().toISOString() },
      { onConflict: "company_id,phone" },
    );
}

async function clearSession(supabase: ReturnType<typeof getServiceClient>, phone: string) {
  await supabase
    .from("whatsapp_sessions")
    .delete()
    .eq("company_id", DEFAULT_COMPANY_ID)
    .eq("phone", phone);
}

async function notifyStaff(message: string, botPhone: string, managerPhone: string | null) {
  if (botPhone) await sendUazapiMessage({ to: botPhone, message });
  if (managerPhone && managerPhone !== botPhone) {
    await sendUazapiMessage({ to: managerPhone, message });
  }
}

// ── Gestor ────────────────────────────────────────────────────────────────────

async function processManagerCommand(
  supabase: ReturnType<typeof getServiceClient>,
  command: ReturnType<typeof parseManagerCommand>,
  managerPhone: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("process_commands", {
    body: { companyId: DEFAULT_COMPANY_ID, managerPhone, command },
  });
  if (error) throw error;
  return data?.message ?? "Comando processado.";
}

// ── Utilitários ───────────────────────────────────────────────────────────────

async function logOutbound(
  supabase: ReturnType<typeof getServiceClient>,
  message: string,
  to: string,
  from: string,
  payload: unknown,
) {
  await supabase.from("whatsapp_messages").insert({
    company_id: DEFAULT_COMPANY_ID,
    from_number: from,
    to_number: to,
    message,
    type: "outbound",
    raw_payload: payload,
  });
  try {
    await sendUazapiMessage({ to, message });
  } catch (error) {
    await supabase
      .from("audit_logs")
      .insert({ action: "whatsapp.send.error", payload: { to, message, error: String(error) } });
  }
}

function normalizePhone(v: string) {
  return v.replace(/\D/g, "");
}
function normalizeWhatsappId(v: string) {
  if (isGroupLikeIdentifier(v)) return "";
  return normalizePhone(v.split("@")[0] ?? "");
}
function normalizeText(v: string) {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function extractMessageId(payload: Record<string, unknown>) {
  return (payload as any)?.message?.messageid ?? "";
}
function isGroupLikeIdentifier(v: string) {
  const s = String(v).trim().toLowerCase();
  if (!s) return false;
  return (
    s.endsWith("@g.us") ||
    s.includes("status@broadcast") ||
    s.endsWith("@broadcast") ||
    s.includes("broadcast")
  );
}
function detectOriginContext(payload: Record<string, unknown>) {
  const msg = (payload as any)?.message;
  const rawCandidates = [
    msg?.chatid,
    msg?.from,
    payload?.from,
    (payload as any)?.data?.from,
    (payload as any)?.data?.key?.remoteJid,
    (payload as any)?.event?.from,
  ];
  const rawJid = rawCandidates.find((x) => typeof x === "string" && x.length > 0) as
    | string
    | undefined;
  const rawFrom = msg?.sender_pn ?? rawJid ?? "";
  const hasGroupFlag = msg?.isGroup === true;
  const hasFromMeFlag = msg?.fromMe === true;
  const looksLikeGroup = rawCandidates.some(
    (x) => typeof x === "string" && isGroupLikeIdentifier(x),
  );
  const isGroupLike = hasGroupFlag || looksLikeGroup;

  return {
    isGroupLike,
    isFromMe: hasFromMeFlag,
    rawFrom: String(rawFrom ?? ""),
    rawJid: String(rawJid ?? ""),
    from: extractFrom(payload),
    to: extractTo(payload),
    text: extractText(payload),
    messageId: extractMessageId(payload),
  };
}
function extractFrom(payload: Record<string, unknown>) {
  const msg = (payload as any)?.message;
  if (msg?.isGroup === true) return "";
  if (msg?.fromMe === true) {
    // gestor usando o próprio bot_phone: remetente = owner da instância
    const selfCandidates = [(payload as any)?.owner, msg?.owner, (payload as any)?.instance_phone];
    const v = selfCandidates.find((x) => typeof x === "string" && x.length > 0) as
      | string
      | undefined;
    return v ? normalizeWhatsappId(v) : "";
  }
  const c = [
    msg?.sender_pn,
    msg?.chatid,
    payload?.from,
    payload?.phone,
    (payload as any)?.data?.from,
    (payload as any)?.data?.key?.remoteJid,
    (payload as any)?.event?.from,
    (payload as any)?.sender,
  ];
  const v = c.find((x) => typeof x === "string" && x.length > 0) as string | undefined;
  return v ? normalizeWhatsappId(v) : "";
}
function extractTo(payload: Record<string, unknown>) {
  const msg = (payload as any)?.message;
  const c = [
    (payload as any)?.owner,
    msg?.owner,
    payload?.to,
    payload?.instance_phone,
    (payload as any)?.data?.to,
    (payload as any)?.recipient,
  ];
  const v = c.find((x) => typeof x === "string" && x.length > 0) as string | undefined;
  return v ? normalizeWhatsappId(v) : "";
}
function extractText(payload: Record<string, unknown>) {
  const msg = (payload as any)?.message;
  const c = [
    msg?.text,
    msg?.content,
    payload?.body,
    (payload as any)?.data?.body,
    (payload as any)?.data?.message?.conversation,
    (payload as any)?.data?.message?.extendedTextMessage?.text,
    (payload as any)?.data?.text,
  ];
  const v = c.find((x) => typeof x === "string" && String(x).trim().length > 0) as
    | string
    | undefined;
  return v?.trim() ?? "";
}
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
