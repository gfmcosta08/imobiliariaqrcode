"use client";

type VisitorInfo = {
  name: string;
  email: string;
  phone: string;
};

type ChatVisitorFormProps = {
  visitorInfo: VisitorInfo;
  onChange: (updater: (prev: VisitorInfo) => VisitorInfo) => void;
};

export function ChatVisitorForm({ visitorInfo, onChange }: ChatVisitorFormProps) {
  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4" data-testid="chat-visitor-form">
      <p className="mb-3 text-sm text-gray-700">
        Opcional: informe seus dados para facilitar o retorno. Voce pode enviar mensagens sem
        preencher.
      </p>
      <label className="mb-2 block text-xs font-medium text-gray-600">
        Nome
        <input
          type="text"
          value={visitorInfo.name}
          onChange={(e) => onChange((prev) => ({ ...prev, name: e.target.value }))}
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
          value={visitorInfo.email}
          onChange={(e) => onChange((prev) => ({ ...prev, email: e.target.value }))}
          data-testid="chat-visitor-email"
          className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label className="block text-xs font-medium text-gray-600">
        Telefone / WhatsApp
        <input
          type="tel"
          value={visitorInfo.phone}
          onChange={(e) => onChange((prev) => ({ ...prev, phone: e.target.value }))}
          data-testid="chat-visitor-phone"
          className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          maxLength={32}
          autoComplete="tel"
          placeholder="(11) 99999-9999"
        />
      </label>
    </div>
  );
}
