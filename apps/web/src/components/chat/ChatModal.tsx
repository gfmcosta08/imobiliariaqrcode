"use client";

import { useEffect, useRef } from "react";

import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessageList } from "./ChatMessageList";
import { ChatVisitorForm } from "./ChatVisitorForm";
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
      className="fixed inset-0 z-[60] flex items-end justify-end p-0 sm:items-center sm:justify-center sm:p-4"
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
          <ChatVisitorForm visitorInfo={chat.visitorInfo} onChange={chat.setVisitorInfo} />
        ) : null}

        <ChatMessageList
          messages={chat.messages}
          isTyping={chat.isTyping}
          awaitingReply={chat.awaitingReply}
        />

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
