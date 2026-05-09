"use client";

import { useEffect, useMemo, useState } from "react";

type RoutingRecipient = {
  id?: string;
  display_name: string | null;
  whatsapp_number: string | null;
  position: number;
  status?: string | null;
  is_primary?: boolean | null;
};

type RoutingResponse = {
  premium_active: boolean;
  max_brokers: number;
  primary: RoutingRecipient;
  recipients: RoutingRecipient[];
};

type AdditionalBroker = {
  name: string;
  whatsapp: string;
};

const EMPTY_BROKERS: AdditionalBroker[] = Array.from({ length: 4 }, () => ({
  name: "",
  whatsapp: "",
}));

function emptyAdditionalBrokers() {
  return EMPTY_BROKERS.map((broker) => ({ ...broker }));
}

function toAdditionalBrokers(recipients: RoutingRecipient[]) {
  const byPosition = new Map(
    recipients
      .filter((recipient) => !recipient.is_primary && recipient.status !== "inactive")
      .map((recipient) => [recipient.position, recipient]),
  );

  return emptyAdditionalBrokers().map((_, index) => {
    const recipient = byPosition.get(index + 2);
    return {
      name: recipient?.display_name ?? "",
      whatsapp: recipient?.whatsapp_number ?? "",
    };
  });
}

export function PremiumLeadRoutingForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<RoutingResponse | null>(null);
  const [brokers, setBrokers] = useState<AdditionalBroker[]>(emptyAdditionalBrokers);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRouting() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/premium/lead-routing", { cache: "no-store" });
        const body = (await response.json()) as Partial<RoutingResponse> & { error?: string };

        if (!response.ok) {
          throw new Error(body.error ?? "Nao foi possivel carregar os corretores Premium.");
        }

        if (!active) return;

        const routing = body as RoutingResponse;
        setData(routing);
        setBrokers(toAdditionalBrokers(routing.recipients ?? []));
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Erro ao carregar corretores.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRouting();

    return () => {
      active = false;
    };
  }, []);

  const filledBrokers = useMemo(
    () => brokers.filter((broker) => broker.name.trim() || broker.whatsapp.trim()),
    [brokers],
  );

  function updateBroker(index: number, field: keyof AdditionalBroker, value: string) {
    setMessage(null);
    setError(null);
    setBrokers((current) =>
      current.map((broker, brokerIndex) =>
        brokerIndex === index ? { ...broker, [field]: value } : broker,
      ),
    );
  }

  async function saveRouting() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/premium/lead-routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: filledBrokers }),
      });
      const body = (await response.json()) as Partial<RoutingResponse> & {
        error?: string;
        recipients?: RoutingRecipient[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Nao foi possivel salvar os corretores.");
      }

      setBrokers(toAdditionalBrokers(body.recipients ?? []));
      setMessage("Corretores Premium atualizados com sucesso.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar corretores.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-5 text-sm text-gray-500">Carregando corretores Premium...</p>;
  }

  if (!data?.premium_active) {
    return (
      <p className="mt-5 text-sm text-gray-500">
        O cadastro de ate 5 corretores fica disponivel para contas Premium ativas.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Corretor principal
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-400">Nome</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {data.primary.display_name ?? "Corretor"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">WhatsApp</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {data.primary.whatsapp_number ?? "Nao informado"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {brokers.map((broker, index) => (
          <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[80px_1fr_1fr]">
            <div className="flex items-end">
              <span className="pb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                #{index + 2}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">Nome do corretor</span>
              <input
                value={broker.name}
                onChange={(event) => updateBroker(index, "name", event.target.value)}
                placeholder="Nome"
                className="rounded-none border border-zinc-300 bg-white px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">WhatsApp</span>
              <input
                value={broker.whatsapp}
                onChange={(event) => updateBroker(index, "whatsapp", event.target.value)}
                placeholder="5511999999999"
                type="tel"
                className="rounded-none border border-zinc-300 bg-white px-3 py-2"
              />
            </label>
          </div>
        ))}
      </div>

      {error ? (
        <p className="rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-none border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={saveRouting}
        disabled={saving}
        className="rounded-none bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar corretores Premium"}
      </button>
    </div>
  );
}
