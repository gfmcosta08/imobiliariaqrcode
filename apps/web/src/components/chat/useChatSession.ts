"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  computeSinceFromMessages,
  dedupeMessagesById,
  FALE_CONOSCO_ACCEPTED_KEY,
  FALE_CONOSCO_SESSION_KEY,
  hasPendingVisitorReply,
  resolveChatReplyState,
  scheduleNextPoll,
  type ChatMessage,
} from "@/lib/chat";

type VisitorInfo = {
  name: string;
  email: string;
};

type UseChatSessionOptions = {
  isLoggedIn: boolean;
  enabled: boolean;
};

export function useChatSession({ isLoggedIn, enabled }: UseChatSessionOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo>({ name: "", email: "" });
  const [visitorInfoComplete, setVisitorInfoComplete] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const ensureSessionId = useCallback((): string => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem(FALE_CONOSCO_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(FALE_CONOSCO_SESSION_KEY, id);
    }
    setSessionId(id);
    return id;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    ensureSessionId();
    const accepted = sessionStorage.getItem(FALE_CONOSCO_ACCEPTED_KEY) === "true";
    setLgpdAccepted(accepted);
    if (isLoggedIn) {
      setVisitorInfoComplete(true);
    }
  }, [enabled, ensureSessionId, isLoggedIn]);

  const acceptLgpd = useCallback(() => {
    sessionStorage.setItem(FALE_CONOSCO_ACCEPTED_KEY, "true");
    setLgpdAccepted(true);
  }, []);

  const fetchMessages = useCallback(async () => {
    const sid = sessionId || ensureSessionId();
    if (!sid) return;

    const since = computeSinceFromMessages(messagesRef.current);
    const params = new URLSearchParams({ session_id: sid });
    if (since) params.set("since", since);

    try {
      const res = await fetch(`/api/chat/messages?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => dedupeMessagesById([...prev, ...data.messages!]));
      }
    } catch {
      // Falha silenciosa no polling.
    }
  }, [ensureSessionId, sessionId]);

  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (!enabled || !lgpdAccepted) return;

    const tick = () => {
      void fetchMessages();
      pollTimerRef.current = scheduleNextPoll(tick, document.hidden);
    };

    pollTimerRef.current = scheduleNextPoll(tick, document.hidden);
  }, [enabled, fetchMessages, lgpdAccepted]);

  useEffect(() => {
    if (!hasPendingVisitorReply(messages)) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [messages]);

  useEffect(() => {
    if (!enabled || !lgpdAccepted) return;

    void fetchMessages();
    schedulePoll();

    const onVisibility = () => schedulePoll();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [enabled, fetchMessages, lgpdAccepted, schedulePoll]);

  const submitVisitorInfo = useCallback(() => {
    const name = visitorInfo.name.trim();
    const email = visitorInfo.email.trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSendError("Informe nome e e-mail validos.");
      return false;
    }
    setVisitorInfoComplete(true);
    setSendError(null);
    return true;
  }, [visitorInfo.email, visitorInfo.name]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!lgpdAccepted) return false;

      if (!isLoggedIn) {
        const name = visitorInfo.name.trim();
        const email = visitorInfo.email.trim();
        if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setSendError("Informe nome e e-mail validos antes de enviar.");
          return false;
        }
        setVisitorInfoComplete(true);
      }

      const sid = ensureSessionId();
      if (!sid) return false;

      setIsSending(true);
      setSendError(null);

      const body: Record<string, string> = {
        session_id: sid,
        content,
        page_url: typeof window !== "undefined" ? window.location.href : "",
      };

      if (!isLoggedIn) {
        body.visitor_name = visitorInfo.name.trim();
        body.visitor_email = visitorInfo.email.trim();
      }

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; id?: string };
        if (!res.ok || !data.ok) {
          setSendError("Nao foi possivel enviar. Tente novamente.");
          return false;
        }

        const optimistic: ChatMessage = {
          id: data.id ?? crypto.randomUUID(),
          session_id: sid,
          user_id: null,
          visitor_name: isLoggedIn ? null : visitorInfo.name.trim(),
          visitor_email: isLoggedIn ? null : visitorInfo.email.trim(),
          direction: "visitor",
          kind: "duvida",
          content,
          is_read_by_costa: false,
          created_at: new Date().toISOString(),
          metadata: null,
        };
        setMessages((prev) => dedupeMessagesById([...prev, optimistic]));
        void fetchMessages();
        return true;
      } catch {
        setSendError("Nao foi possivel enviar. Tente novamente.");
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [ensureSessionId, fetchMessages, isLoggedIn, lgpdAccepted, visitorInfo.email, visitorInfo.name],
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem(FALE_CONOSCO_ACCEPTED_KEY);
    localStorage.removeItem(FALE_CONOSCO_SESSION_KEY);
    setLgpdAccepted(false);
    setVisitorInfoComplete(isLoggedIn);
    setVisitorInfo({ name: "", email: "" });
    setSendError(null);
    ensureSessionId();
  }, [ensureSessionId, isLoggedIn]);

  const replyState = resolveChatReplyState(messages, nowMs);

  return {
    messages,
    sessionId,
    lgpdAccepted,
    acceptLgpd,
    visitorInfo,
    setVisitorInfo,
    visitorInfoComplete,
    submitVisitorInfo,
    isSending,
    sendError,
    sendMessage,
    clearConversation,
    isTyping: replyState.isTyping,
    awaitingReply: replyState.awaitingReply,
    needsVisitorInfo: !isLoggedIn && !visitorInfoComplete,
  };
}
