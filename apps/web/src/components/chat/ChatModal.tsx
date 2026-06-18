"use client";

import { useEffect, useRef } from "react";

import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessageList } from "./ChatMessageList";
import { LgpdBanner } from "./LgpdBanner";
import { useChatSession } from "./useChatSession";

type ChatModalProps = {
  open: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
};

export function ChatModal({ open, onClose, isLoggedIn }: ChatModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const chat = useChatSession({ isLoggedIn, enabled: open });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const inputDisabled = !chat.lgpdAccepted;
  const showVisitorForm = chat.lgpdAccepted && !isLoggedIn;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:items-center sm:justify-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar chat"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-modal-title"
        data-testid="chat-modal"
        className="relative flex h-full w-full flex-col bg-white shadow-xl sm:h-[600px] sm:max-h-[90vh] sm:w-[380px] sm:max-w-[calc(100vw-2rem)]"
      >
        <ChatHeader
          onClose={onClose}
          onClear={() => {
            chat.clearConversation();
          }}
        />

        {!chat.lgpdAccepted ? <LgpdBanner onAccept={chat.acceptLgpd} /> : null}

        {showVisitorForm ? (
          <div className="border-b border-gray-200 bg-gray-50 p-4" data-testid="chat-visitor-form">
            <p className="mb-3 text-sm text-gray-700">
              Antes de enviar, informe seu nome e e-mail para retorno.
            </p>
            <label className="mb-2 block text-xs font-medium text-gray-600">
              Nome
              <input
                type="text"
                value={chat.visitorInfo.name}
                onChange={(e) => chat.setVisitorInfo((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="chat-visitor-name"
                className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
                maxLength={120}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              E-mail
              <input
                type="email"
                value={chat.visitorInfo.email}
                onChange={(e) =>
                  chat.setVisitorInfo((prev) => ({ ...prev, email: e.target.value }))
                }
                data-testid="chat-visitor-email"
                className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
                maxLength={254}
              />
            </label>
            {chat.sendError ? (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {chat.sendError}
              </p>
            ) : null}
          </div>
        ) : null}

        <ChatMessageList messages={chat.messages} isTyping={chat.isTyping} />

        {chat.sendError ? (
          <p className="px-4 pb-1 text-xs text-red-600" role="alert">
            {chat.sendError}
          </p>
        ) : null}

        <ChatInput
          disabled={inputDisabled}
          isSending={chat.isSending}
          onSend={chat.sendMessage}
          autoFocus={chat.lgpdAccepted}
        />
      </div>
    </div>
  );
}
