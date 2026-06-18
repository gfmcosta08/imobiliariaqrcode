"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CHAT_CONTENT_MAX_LENGTH } from "@/lib/chat";

type ChatInputProps = {
  disabled: boolean;
  isSending: boolean;
  onSend: (content: string) => Promise<boolean>;
  autoFocus?: boolean;
};

const MAX_LINES = 5;
const LINE_HEIGHT_PX = 24;

export function ChatInput({ disabled, isSending, onSend, autoFocus }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT_PX * MAX_LINES + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || isSending) return;
    const ok = await onSend(trimmed);
    if (ok) setValue("");
  };

  const remaining = CHAT_CONTENT_MAX_LENGTH - value.length;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="border-t border-gray-200 bg-white p-3"
      data-testid="chat-input-form"
    >
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, CHAT_CONTENT_MAX_LENGTH))}
          disabled={disabled || isSending}
          rows={1}
          placeholder="Digite sua mensagem..."
          data-testid="chat-input"
          aria-label="Mensagem"
          className="w-full resize-none border border-gray-200 px-3 py-2 pr-12 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled || isSending || !value.trim()}
          data-testid="chat-send"
          aria-label="Enviar mensagem"
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white transition hover:bg-zinc-800 disabled:bg-gray-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 2.25 2.25 0 001.871-.502l15.06-15.06a.75.75 0 00-.502-1.25l-15.06 15.06a2.25 2.25 0 00-.502-1.871z" />
          </svg>
        </button>
      </div>
      <p className="mt-1 text-right text-[10px] text-gray-400" aria-live="off">
        {remaining} caracteres restantes
      </p>
    </form>
  );
}
