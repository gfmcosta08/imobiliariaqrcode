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
import { normalizeBrazilPhone } from "@/lib/phone";

export type VisitorInfo = {
  name: string;
  email: string;
  phone: string;
};

const FALE_CONOSCO_VISITOR_KEY = "fale_conosco_visitor_info";

function loadVisitorInfo(): VisitorInfo {
  if (typeof window === "undefined") return { name: "", email: "", phone: "" };
  try {
    const raw = sessionStorage.getItem(FALE_CONOSCO_VISITOR_KEY);
    if (!raw) return { name: "", email: "", phone: "" };
    const parsed = JSON.parse(raw) as Partial<VisitorInfo>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
    };
  } catch {
    return { name: "", email: "", phone: "" };
  }
}

function saveVisitorInfo(info: VisitorInfo): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FALE_CONOSCO_VISITOR_KEY, JSON.stringify(info));
}

export function validateOptionalVisitorInfo(info: VisitorInfo): string | null {
  const email = info.email.trim();
  const phone = info.phone.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "E-mail invalido. Corrija ou deixe em branco.";
  }
  if (phone && !normalizeBrazilPhone(phone)) {
    return "Telefone invalido. Corrija ou deixe em branco.";
  }
  return null;
}

type UseChatSessionOptions = {
  isLoggedIn: boolean;
  enabled: boolean;
};

export function useChatSession({ isLoggedIn, enabled }: UseChatSessionOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [visitorInfo, setVisitorInfoState] = useState<VisitorInfo>({
    name: "",
    email: "",
    phone: "",
  });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  const setVisitorInfo = useCallback((updater: (prev: VisitorInfo) => VisitorInfo) => {
    setVisitorInfoState((prev) => {
      const next = updater(prev);
      saveVisitorInfo(next);
      return next;
    });
  }, []);

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
    if (!isLoggedIn) {
      setVisitorInfoState(loadVisitorInfo());
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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!lgpdAccepted) return false;

      if (!isLoggedIn) {
        const validationError = validateOptionalVisitorInfo(visitorInfo);
        if (validationError) {
          setSendError(validationError);
          return false;
        }
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
        const name = visitorInfo.name.trim();
        const email = visitorInfo.email.trim();
        const phone = visitorInfo.phone.trim();
        if (name) body.visitor_name = name;
        if (email) body.visitor_email = email;
        if (phone) body.visitor_phone = phone;
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
          visitor_name: isLoggedIn ? null : visitorInfo.name.trim() || null,
          visitor_email: isLoggedIn ? null : visitorInfo.email.trim() || null,
          direction: "visitor",
          kind: "duvida",
          content,
          is_read_by_costa: false,
          created_at: new Date().toISOString(),
          metadata: isLoggedIn
            ? null
            : visitorInfo.phone.trim()
              ? { visitor_phone: normalizeBrazilPhone(visitorInfo.phone.trim()) }
              : null,
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
    [ensureSessionId, fetchMessages, isLoggedIn, lgpdAccepted, visitorInfo],
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem(FALE_CONOSCO_ACCEPTED_KEY);
    sessionStorage.removeItem(FALE_CONOSCO_VISITOR_KEY);
    localStorage.removeItem(FALE_CONOSCO_SESSION_KEY);
    setLgpdAccepted(false);
    setVisitorInfoState({ name: "", email: "", phone: "" });
    setSendError(null);
    ensureSessionId();
  }, [ensureSessionId]);

  const replyState = resolveChatReplyState(messages, nowMs);

  return {
    messages,
    sessionId,
    lgpdAccepted,
    acceptLgpd,
    visitorInfo,
    setVisitorInfo,
    isSending,
    sendError,
    sendMessage,
    clearConversation,
    isTyping: replyState.isTyping,
    awaitingReply: replyState.awaitingReply,
  };
}
