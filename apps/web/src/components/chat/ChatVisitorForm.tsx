"use client";

import type { VisitorFormMode, VisitorInfo } from "./visitor-info";
import { formatVisitorSummary, hasVisitorInfo } from "./visitor-info";

export type { VisitorFormMode } from "./visitor-info";
export { formatVisitorSummary, hasVisitorInfo };

type ChatVisitorFormProps = {
  mode: VisitorFormMode;
  savedInfo: VisitorInfo;
  draft: VisitorInfo;
  error?: string | null;
  onDraftChange: (updater: (prev: VisitorInfo) => VisitorInfo) => void;
  onExpand: () => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ChatVisitorForm({
  mode,
  savedInfo,
  draft,
  error,
  onDraftChange,
  onExpand,
  onSave,
  onCancel,
}: ChatVisitorFormProps) {
  if (mode === "hidden") {
    return (
      <div className="border-b border-gray-200 bg-white px-4 py-2" data-testid="chat-visitor-hidden">
        <button
          type="button"
          onClick={onExpand}
          data-testid="chat-visitor-expand"
          className="text-xs font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
        >
          Informar seus dados (opcional)
        </button>
      </div>
    );
  }

  if (mode === "bar") {
    const summary = formatVisitorSummary(savedInfo);
    return (
      <div
        className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2"
        data-testid="chat-visitor-bar"
      >
        <p className="min-w-0 truncate text-xs text-gray-600">
          {summary || "Dados opcionais para facilitar o retorno"}
        </p>
        <button
          type="button"
          onClick={onExpand}
          data-testid="chat-visitor-edit"
          className="shrink-0 text-xs font-medium text-gray-900 underline-offset-2 hover:underline"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4" data-testid="chat-visitor-form">
      <p className="mb-3 text-sm text-gray-700">
        Opcional: informe seus dados para facilitar o retorno. Salve para liberar espaco ao chat.
      </p>
      <label className="mb-2 block text-xs font-medium text-gray-600">
        Nome
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, name: e.target.value }))}
          data-testid="chat-visitor-name"
          className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          maxLength={120}
          autoComplete="name"
        />
      </label>
      <label className="mb-2 block text-xs font-medium text-gray-600">
        E-mail
        <input
          type="email"
          value={draft.email}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, email: e.target.value }))}
          data-testid="chat-visitor-email"
          className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label className="mb-3 block text-xs font-medium text-gray-600">
        Telefone / WhatsApp
        <input
          type="tel"
          value={draft.phone}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, phone: e.target.value }))}
          data-testid="chat-visitor-phone"
          className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          maxLength={32}
          autoComplete="tel"
          placeholder="(11) 99999-9999"
        />
      </label>
      {error ? (
        <p className="mb-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          data-testid="chat-visitor-save"
          className="flex-1 bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          data-testid="chat-visitor-cancel"
          className="flex-1 border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
