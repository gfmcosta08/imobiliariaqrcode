"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { markPropertyAsSold, updatePropertyStatus } from "../actions";

const statuses = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Disponível" },
  { value: "printed", label: "Impresso" },
  { value: "removed", label: "Vendido (remover do sistema)" },
];

function applyDateMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const value = Number(digits) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function StatusForm(props: { propertyId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(props.currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [soldDate, setSoldDate] = useState("");
  const [soldCommission, setSoldCommission] = useState("");
  const [soldNotes, setSoldNotes] = useState("");

  async function onSave() {
    setError(null);

    if (status === "removed" && props.currentStatus !== "removed") {
      setShowSoldModal(true);
      return;
    }

    setLoading(true);
    const res = await updatePropertyStatus(props.propertyId, status);
    setLoading(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function onConfirmSold(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await markPropertyAsSold({
      propertyId: props.propertyId,
      confirmText,
      soldDate,
      soldCommission,
      soldNotes,
    });

    setLoading(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }

    setShowSoldModal(false);
    setConfirmText("");
    setSoldDate("");
    setSoldCommission("");
    setSoldNotes("");
    setStatus("removed");
    router.refresh();
  }

  return (
    <>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Status do anúncio</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-none border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={loading || status === props.currentStatus}
          className="rounded-none bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Salvando..." : "Atualizar status"}
        </button>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {showSoldModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={onConfirmSold}
            className="w-full max-w-lg rounded-none border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Confirmar venda
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Este anúncio será removido do sistema. Para confirmar, digite <strong>VENDIDO</strong>
              , informe a data da venda e a comissão.
            </p>

            <div className="mt-4 space-y-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Confirmação</span>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Digite VENDIDO"
                  className="rounded-none border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Data da venda (dd/mm/aaaa)</span>
                <input
                  value={soldDate}
                  onChange={(e) => setSoldDate(applyDateMask(e.target.value))}
                  placeholder="dd/mm/aaaa"
                  className="rounded-none border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Comissão</span>
                <input
                  value={soldCommission}
                  onChange={(e) => setSoldCommission(formatCurrencyInput(e.target.value))}
                  placeholder="R$ 0,00"
                  className="rounded-none border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Observação (opcional)</span>
                <textarea
                  value={soldNotes}
                  onChange={(e) => setSoldNotes(e.target.value)}
                  rows={3}
                  className="rounded-none border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSoldModal(false)}
                className="rounded-none border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-none bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {loading ? "Confirmando..." : "Confirmar venda"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
