"use client";

import { useState, useTransition } from "react";

import { updateLead } from "../actions";

type LeadEditorProps = {
  leadId: string;
  initial: {
    nome_completo: string;
    primeiro_nome: string;
    observacoes: string;
    interesses: string[];
    status: string;
    nome_validado: boolean;
  };
};

export function LeadEditorForm({ leadId, initial }: LeadEditorProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);

        startTransition(async () => {
          setError(null);
          setSuccess(null);

          const result = await updateLead({
            leadId,
            nome_completo: String(fd.get("nome_completo") ?? ""),
            primeiro_nome: String(fd.get("primeiro_nome") ?? ""),
            observacoes: String(fd.get("observacoes") ?? ""),
            interesses: String(fd.get("interesses") ?? ""),
            status: String(fd.get("status") ?? ""),
            nome_validado: String(fd.get("nome_validado") ?? "") === "true",
          });

          if ("error" in result) {
            setError(result.error ?? "Erro ao atualizar lead.");
            return;
          }

          setSuccess("Lead atualizado com sucesso.");
        });
      }}
    >
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Nome completo</span>
        <input
          name="nome_completo"
          defaultValue={initial.nome_completo}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Primeiro nome</span>
        <input
          name="primeiro_nome"
          defaultValue={initial.primeiro_nome}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Status</span>
        <select
          name="status"
          defaultValue={initial.status}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="new">new</option>
          <option value="contacted">contacted</option>
          <option value="scheduled">scheduled</option>
          <option value="closed">closed</option>
          <option value="invalid">invalid</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Nome validado</span>
        <select
          name="nome_validado"
          defaultValue={initial.nome_validado ? "true" : "false"}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="true">Sim</option>
          <option value="false">Nao</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Interesses (linha ou virgula)</span>
        <textarea
          name="interesses"
          rows={3}
          defaultValue={(initial.interesses ?? []).join("\n")}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Observacoes</span>
        <textarea
          name="observacoes"
          rows={8}
          defaultValue={initial.observacoes}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Salvando..." : "Salvar lead"}
      </button>
    </form>
  );
}
