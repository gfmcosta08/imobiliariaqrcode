import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/env.ts";
import { sendUazapiMessage } from "../_shared/uazapi.ts";
import type { ManagerCommand } from "../_shared/parser.ts";

type ProcessPayload = {
  companyId: string;
  managerPhone: string;
  command: ManagerCommand;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ProcessPayload;
    const supabase = getServiceClient();

    const message = await routeCommand(supabase, payload);

    await supabase.rpc("log_audit", {
      p_action: "manager.command",
      p_payload: {
        command: payload.command,
        company_id: payload.companyId,
        manager_phone: payload.managerPhone,
      },
    });

    return new Response(JSON.stringify({ ok: true, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getBrtTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

async function routeCommand(
  supabase: ReturnType<typeof getServiceClient>,
  payload: ProcessPayload,
): Promise<string> {
  switch (payload.command.type) {
    case "confirmar":
      return confirmByCustomerAndTime(
        supabase,
        payload.companyId,
        payload.command.customerName,
        payload.command.time,
      );
    case "sugerir":
      return suggestSlot(
        supabase,
        payload.companyId,
        payload.command.customerName,
        payload.command.time,
      );
    case "cancelar":
      return cancelByCustomerAndTime(
        supabase,
        payload.companyId,
        payload.command.customerName,
        payload.command.time,
      );
    case "agenda_hoje":
      return agendaHoje(supabase, payload.companyId);
    case "agenda_semana":
      return agendaSemana(supabase, payload.companyId);
    case "encaixar":
      return encaixar(
        supabase,
        payload.companyId,
        payload.command.time,
        payload.command.customerName,
        payload.command.serviceName,
      );
    case "add_servico":
      return addServico(
        supabase,
        payload.companyId,
        payload.command.name,
        payload.command.category,
        payload.command.price,
        payload.command.description,
      );
    case "servicos":
      return listarServicos(supabase, payload.companyId);
    case "pendentes":
      return listarPendentes(supabase, payload.companyId);
    case "template_help":
      return templateHelp(payload.command.code);
    case "ajuda":
      return ajudaGestor();
    default:
      return "Comando nao reconhecido. Use: 1-servicos, 2-pendentes, 3-agenda hoje, 4-agenda semana, 5-modelo confirmar, 6-modelo sugerir, 7-modelo cancelar, 8-modelo encaixar.";
  }
}

function ajudaGestor(): string {
  return (
    `*Comandos do gestor:*\n\n` +
    `*Ao receber agendamento pendente:*\n` +
    `5 - Confirmar\n` +
    `6 - Sugerir outro horario\n` +
    `7 - Cancelar\n` +
    `8 - Encaixar (qualquer horario)\n\n` +
    `*Consultas:*\n` +
    `1 - Listar servicos\n` +
    `2 - Agendamentos pendentes\n` +
    `3 - Agenda de hoje\n` +
    `4 - Agenda da semana\n\n` +
    `*Acoes:*\n` +
    `confirmar Nome HH:MM\n` +
    `cancelar Nome HH:MM\n` +
    `sugerir Nome HH:MM\n` +
    `encaixar HH:MM Nome Servico\n\n` +
    `*Cadastro:*\n` +
    `+servico Nome Categoria Preco Descricao\n\n` +
    `ajuda - exibe esta lista`
  );
}

function templateHelp(code: 5 | 6 | 7 | 8): string {
  if (code === 5) {
    return "Modelo 5 - Confirmar:\nconfirmar NomeCliente 09:00\nExemplo: confirmar Joao 09:00";
  }

  if (code === 6) {
    return "Modelo 6 - Sugerir horario:\nsugerir NomeCliente 14:00\nExemplo: sugerir Maria 14:00";
  }

  if (code === 7) {
    return "Modelo 7 - Cancelar pendente:\ncancelar NomeCliente 09:00\nExemplo: cancelar Joao 09:00";
  }

  return "Modelo 8 - Encaixar cliente:\nencaixar 10:00 NomeCliente NomeServico\nExemplo: encaixar 10:00 Maria alinhamento";
}

async function confirmByCustomerAndTime(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
  customerName: string,
  time: string,
): Promise<string> {
  const today = getBrtTodayIso();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, status, date, time, customers(name, phone), services(name)")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .eq("time", time)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  const match = data?.find((item) =>
    String((item as unknown as { customers: { name: string } }).customers?.name ?? "")
      .toLowerCase()
      .includes(customerName.toLowerCase()),
  );

  if (!match) {
    return `Nenhum agendamento pendente encontrado para ${customerName} as ${time}.`;
  }

  const row = match as unknown as {
    id: string;
    date: string;
    time: string;
    customers: { name: string; phone: string };
    services: { name: string };
  };

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", row.id);
  if (updateError) throw updateError;

  // Criar entrada na fila unificada
  await supabase.from("contact_queue").insert({
    company_id: companyId,
    name: row.customers?.name ?? customerName,
    phone: row.customers?.phone ?? "",
    source: "whatsapp",
    appointment_id: row.id,
    requested_service: row.services?.name ?? "",
    requested_time: `${row.date} ${row.time}`,
    status: "converted",
  });

  const customerPhone = row.customers?.phone;
  if (customerPhone) {
    const [, mm, dd] = row.date.split("-");
    try {
      await sendUazapiMessage({
        to: customerPhone,
        message: `Seu agendamento das *${row.time.slice(0, 5)}* do dia *${dd}/${mm}* foi *confirmado!* Ate breve.`,
      });
    } catch {
      // nao falhar o comando se envio falhar
    }
  }

  return `Agendamento de ${customerName} as ${time} confirmado. Cliente notificado via WhatsApp.`;
}

async function suggestSlot(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
  customerName: string,
  time: string,
): Promise<string> {
  const { data } = await supabase
    .from("appointments")
    .select("customers(name, phone)")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("date", { ascending: true })
    .limit(20);

  const match = data?.find((item) =>
    String((item as unknown as { customers: { name: string } }).customers?.name ?? "")
      .toLowerCase()
      .includes(customerName.toLowerCase()),
  );

  const customerPhone = (match as unknown as { customers: { phone: string } } | undefined)
    ?.customers?.phone;
  if (!customerPhone) {
    return `Cliente ${customerName} nao encontrado em agendamentos pendentes.`;
  }

  try {
    await sendUazapiMessage({
      to: customerPhone,
      message: `Ola! Temos um horario disponivel: *${time}*.\nDeseja remarcar? Digite *1* para agendar ou *oi* para ver o menu.`,
    });
  } catch {
    return `Nao foi possivel enviar mensagem para ${customerName}.`;
  }

  return `Horario ${time} sugerido para ${customerName}. Cliente notificado via WhatsApp.`;
}

async function cancelByCustomerAndTime(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
  customerName: string,
  time: string,
): Promise<string> {
  const today = getBrtTodayIso();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, date, time, customers(name, phone)")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .eq("time", time)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  const match = data?.find((item) =>
    String((item as unknown as { customers: { name: string } }).customers?.name ?? "")
      .toLowerCase()
      .includes(customerName.toLowerCase()),
  );

  if (!match) {
    return `Nenhum agendamento pendente encontrado para ${customerName} as ${time}.`;
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "canceled" })
    .eq("id", match.id);
  if (updateError) {
    throw updateError;
  }

  const customerPhone = (match as unknown as { customers: { phone: string } }).customers?.phone;
  if (customerPhone) {
    const date = (match as unknown as { date: string }).date;
    const [, mm, dd] = date.split("-");
    try {
      await sendUazapiMessage({
        to: customerPhone,
        message: `Seu agendamento das *${time}* do dia *${dd}/${mm}* foi cancelado. Aguarde contato do gestor para novo horario.`,
      });
    } catch {
      // nao falhar o comando se envio falhar
    }
  }

  return `Agendamento pendente de ${customerName} as ${time} cancelado.`;
}

async function agendaHoje(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
): Promise<string> {
  const today = getBrtTodayIso();

  const { data, error } = await supabase
    .from("appointments")
    .select("time, status, customers(name), services(name)")
    .eq("company_id", companyId)
    .eq("date", today)
    .order("time", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return "Agenda de hoje vazia.";
  }

  const lines = data.map((item) => {
    const row = item as unknown as {
      time: string;
      status: string;
      customers: { name: string };
      services: { name: string };
    };
    return `${row.time.slice(0, 5)} | ${row.customers?.name ?? "Cliente"} | ${row.services?.name ?? "Servico"} | ${row.status}`;
  });

  return `Agenda de hoje:\n${lines.join("\n")}`;
}

async function agendaSemana(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
): Promise<string> {
  const todayIso = getBrtTodayIso();
  const end = new Date();
  end.setDate(end.getDate() + 7);
  const endIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(end);

  const { data, error } = await supabase
    .from("appointments")
    .select("date, time, status")
    .eq("company_id", companyId)
    .gte("date", todayIso)
    .lte("date", endIso)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return "Sem agendamentos para os proximos 7 dias.";
  }

  const lines = data.map((item) => `${item.date} ${item.time.slice(0, 5)} ${item.status}`);
  return `Agenda da semana:\n${lines.join("\n")}`;
}

async function encaixar(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
  time: string,
  customerName: string,
  serviceName: string,
): Promise<string> {
  const today = getBrtTodayIso();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", `%${serviceName}%`)
    .eq("active", true)
    .limit(1)
    .single();

  if (serviceError || !service) {
    return `Servico '${serviceName}' nao encontrado.`;
  }

  const customerPhone = `manual-${Date.now()}`;

  const { data: customer, error: customerError } = await supabase.rpc("find_or_create_customer", {
    p_company_id: companyId,
    p_name: customerName,
    p_phone: customerPhone,
    p_email: null,
  });

  if (customerError) {
    throw customerError;
  }

  const { error: appointmentError } = await supabase.from("appointments").insert({
    company_id: companyId,
    customer_id: customer.id,
    service_id: service.id,
    date: today,
    time,
    status: "confirmed",
    source: "whatsapp",
    auto_confirmed: true,
    notes: "Encaixe via comando WhatsApp",
  });

  if (appointmentError) {
    return `Nao foi possivel encaixar ${customerName} as ${time}: conflito de horario.`;
  }

  return `Encaixe confirmado: ${customerName} as ${time}.`;
}

async function addServico(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
  name: string,
  category: string,
  price: number,
  description: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      company_id: companyId,
      number: 0,
      name,
      category,
      price,
      description,
      active: true,
    })
    .select("number")
    .single();

  if (error) {
    throw error;
  }

  return `Servico criado com sucesso. Numero: ${data.number}.`;
}

async function listarServicos(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("services")
    .select("number, name, price")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("number", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return "Nenhum servico ativo.";
  }

  return data
    .map((item) => `${item.number} - ${item.name} (R$ ${Number(item.price).toFixed(2)})`)
    .join("\n");
}

async function listarPendentes(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("appointments")
    .select("date, time, customers(name), services(name)")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return "Nenhum agendamento pendente.";
  }

  return data
    .map((item) => {
      const row = item as unknown as {
        date: string;
        time: string;
        customers: { name: string };
        services: { name: string };
      };
      return `${row.date} ${row.time.slice(0, 5)} | ${row.customers?.name ?? "Cliente"} | ${row.services?.name ?? "Servico"}`;
    })
    .join("\n");
}
