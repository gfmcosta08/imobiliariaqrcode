"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/lib/chat";

type ChatMessageListProps = {
  messages: ChatMessage[];
  isTyping: boolean;
  awaitingReply?: boolean;
};

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return "";
  }
}

export function ChatMessageList({ messages, isTyping, awaitingReply = false }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 80;
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping, awaitingReply]);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto px-4 py-3"
      aria-live="polite"
      aria-relevant="additions"
      data-testid="chat-message-list"
    >
      {messages.length === 0 ? (
        <p className="text-center text-sm text-gray-500">
          Envie sua duvida, sugestao ou reclamacao. Responderemos em breve.
        </p>
      ) : null}

      {messages.map((message) => {
        const isVisitor = message.direction === "visitor";
        return (
          <div
            key={message.id}
            className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}
            data-testid={`chat-message-${message.direction}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                isVisitor ? "bg-black text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <p className={`mt-1 text-[10px] ${isVisitor ? "text-white/60" : "text-gray-400"}`}>
                {formatTime(message.created_at)}
              </p>
            </div>
          </div>
        );
      })}

      {isTyping ? (
        <div className="flex justify-start" data-testid="chat-typing">
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2">
            <span className="sr-only">Digitando</span>
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
          </div>
        </div>
      ) : null}

      {awaitingReply ? (
        <p className="text-center text-xs text-gray-500" data-testid="chat-awaiting-reply">
          Mensagem recebida. Responderemos em breve — voce pode continuar conversando.
        </p>
      ) : null}

      <div ref={bottomRef} aria-hidden="true" className="h-px shrink-0" />
    </div>
  );
}
