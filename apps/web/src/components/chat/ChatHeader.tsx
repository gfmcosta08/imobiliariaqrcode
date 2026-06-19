"use client";

type ChatHeaderProps = {
  onClose: () => void;
  onClear: () => void;
};

export function ChatHeader({ onClose, onClear }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <h2 id="chat-modal-title" className="text-base font-semibold text-gray-900">
        Fale Conosco
      </h2>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          data-testid="chat-clear"
          className="text-xs font-medium text-gray-500 transition hover:text-gray-900"
        >
          Limpar conversa
        </button>
        <button
          type="button"
          onClick={onClose}
          data-testid="chat-close"
          aria-label="Fechar chat"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>
  );
}
