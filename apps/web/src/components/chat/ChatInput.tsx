"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { CHAT_CONTENT_MAX_LENGTH } from "@/lib/chat";

const SEND_LOGO_SRC = "/chat/imoveisqr-logo-send.png";

type ChatInputProps = {
  disabled: boolean;
  isSending: boolean;
  onSend: (content: string) => Promise<boolean>;
  autoFocus?: boolean;
};

const MAX_LINES = 5;
const LINE_HEIGHT_PX = 24;

function SendLogo({ muted }: { muted: boolean }) {
  return (
    <Image
      src={SEND_LOGO_SRC}
      alt=""
      width={22}
      height={22}
      aria-hidden="true"
      className={`h-[22px] w-[22px] object-contain ${muted ? "opacity-50" : ""}`}
    />
  );
}

function SendingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

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

    setValue("");
    resizeTextarea();

    const ok = await onSend(trimmed);
    if (!ok) {
      setValue(trimmed);
      textareaRef.current?.focus();
    }
  };

  const canSend = !disabled && !isSending && value.trim().length > 0;
  const remaining = CHAT_CONTENT_MAX_LENGTH - value.length;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="border-t border-gray-200 bg-white p-3"
      data-testid="chat-input-form"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-2 py-1.5 transition-colors focus-within:border-gray-900 focus-within:bg-white">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, CHAT_CONTENT_MAX_LENGTH))}
          disabled={disabled}
          rows={1}
          placeholder="Digite sua mensagem..."
          data-testid="chat-input"
          aria-label="Mensagem"
          className="min-h-[36px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:text-gray-400"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          data-testid="chat-send"
          aria-label={isSending ? "Enviando mensagem" : "Enviar mensagem"}
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black p-1 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        >
          {isSending ? <SendingSpinner /> : <SendLogo muted={!canSend} />}
        </button>
      </div>
      <p className="mt-1 text-right text-[10px] text-gray-400" aria-live="off">
        {remaining} caracteres restantes
      </p>
    </form>
  );
}
