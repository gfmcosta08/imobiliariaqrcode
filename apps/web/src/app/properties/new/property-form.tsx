"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { createProperty } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "Salvando…" : "Salvar rascunho"}
    </button>
  );
}

export function PropertyForm() {
  const [state, formAction] = useFormState(createProperty, null);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Título (opcional)</span>
        <input
          name="title"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Descrição *</span>
        <textarea
          name="description"
          required
          rows={4}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cidade *</span>
          <input
            name="city"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">UF *</span>
          <input
            name="state"
            required
            maxLength={2}
            placeholder="SP"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 uppercase dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo *</span>
          <input
            name="property_type"
            required
            placeholder="Apartamento"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Subtipo *</span>
          <input
            name="property_subtype"
            required
            placeholder="Padrão"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Finalidade *</span>
        <select
          name="purpose"
          required
          defaultValue="sale"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="sale">Venda</option>
          <option value="rent">Locação</option>
        </select>
      </label>
      <SubmitButton />
      <p className="text-sm">
        <Link href="/properties" className="text-zinc-600 underline dark:text-zinc-400">
          Cancelar
        </Link>
      </p>
    </form>
  );
}
