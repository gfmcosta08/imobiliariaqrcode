"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHAT_CLIENT_MESSAGE_ID_METADATA_KEY,
  computeSinceFromMessages,
  mergeChatMessages,
  FALE_CONOSCO_ACCEPTED_KEY,
  FALE_CONOSCO_SESSION_KEY,
  hasPendingVisitorReply,
  resolveChatReplyState,
  scheduleNextPoll,
  type ChatMessage,
} from "../lib";
import { normalizeBrazilPhone } from "@/lib/phone";

import {
  hasVisitorInfo,
  initialVisitorFormMode,
  validateOptionalVisitorInfo,
  type VisitorFormMode,
  type VisitorInfo,
} from "./visitor-info";

export type { VisitorInfo } from "./visitor-info";
export { validateOptionalVisitorInfo } from "./visitor-info";

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
  const [visitorDraft, setVisitorDraft] = useState<VisitorInfo>({
    name: "",
    email: "",
    phone: "",
  });
  const [visitorFormMode, setVisitorFormMode] = useState<VisitorFormMode>("hidden");
  const [visitorFormError, setVisitorFormError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sendInFlightRef = useRef(false);

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
      const saved = loadVisitorInfo();
      setVisitorInfoState(saved);
      setVisitorDraft(saved);
      setVisitorFormMode(initialVisitorFormMode(saved));
    }
  }, [enabled, ensureSessionId, isLoggedIn]);

  const acceptLgpd = useCallback(() => {
    sessionStorage.setItem(FALE_CONOSCO_ACCEPTED_KEY, "true");
    setLgpdAccepted(true);
    if (!isLoggedIn) {
      const saved = loadVisitorInfo();
      setVisitorFormMode(initialVisitorFormMode(saved));
    }
  }, [isLoggedIn]);

  const expandVisitorForm = useCallback(() => {
    setVisitorDraft({ ...visitorInfo });
    setVisitorFormError(null);
    setVisitorFormMode("expanded");
  }, [visitorInfo]);

  const saveVisitorForm = useCallback(() => {
    const validationError = validateOptionalVisitorInfo(visitorDraft);
    if (validationError) {
      setVisitorFormError(validationError);
      return;
    }
    setVisitorInfoState(visitorDraft);
    saveVisitorInfo(visitorDraft);
    setVisitorFormError(null);
    setVisitorFormMode(hasVisitorInfo(visitorDraft) ? "bar" : "hidden");
  }, [visitorDraft]);

  const cancelVisitorForm = useCallback(() => {
    setVisitorDraft({ ...visitorInfo });
    setVisitorFormError(null);
    setVisitorFormMode("hidden");
  }, [visitorInfo]);

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
        setMessages((prev) => mergeChatMessages(prev, data.messages!));
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
      if (!lgpdAccepted || sendInFlightRef.current) return false;

      if (!isLoggedIn) {
        const validationError = validateOptionalVisitorInfo(visitorInfo);
        if (validationError) {
          setSendError(validationError);
          return false;
        }
      }

      const sid = ensureSessionId();
      if (!sid) return false;

      sendInFlightRef.current = true;
      setIsSending(true);
      setSendError(null);

      const clientMessageId = crypto.randomUUID();
      const optimisticMetadata: Record<string, unknown> = {
        [CHAT_CLIENT_MESSAGE_ID_METADATA_KEY]: clientMessageId,
      };
      if (!isLoggedIn && visitorInfo.phone.trim()) {
        optimisticMetadata.visitor_phone = normalizeBrazilPhone(visitorInfo.phone.trim());
      }

      const optimistic: ChatMessage = {
        id: clientMessageId,
        session_id: sid,
        user_id: null,
        visitor_name: isLoggedIn ? null : visitorInfo.name.trim() || null,
        visitor_email: isLoggedIn ? null : visitorInfo.email.trim() || null,
        direction: "visitor",
        kind: "duvida",
        content,
        is_read_by_costa: false,
        created_at: new Date().toISOString(),
        metadata: optimisticMetadata,
      };
      setMessages((prev) => mergeChatMessages(prev, [optimistic]));

      const body: Record<string, string> = {
        session_id: sid,
        content,
        client_message_id: clientMessageId,
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
        if (!res.ok || !data.ok || !data.id) {
          setMessages((prev) => prev.filter((message) => message.id !== clientMessageId));
          setSendError("Nao foi possivel enviar. Tente novamente.");
          return false;
        }

        setMessages((prev) => {
          const withoutPlaceholder = prev.filter((message) => message.id !== clientMessageId);
          const confirmed: ChatMessage = {
            ...optimistic,
            id: data.id!,
          };
          return mergeChatMessages(withoutPlaceholder, [confirmed]);
        });

        return true;
      } catch {
        setMessages((prev) => prev.filter((message) => message.id !== clientMessageId));
        setSendError("Nao foi possivel enviar. Tente novamente.");
        return false;
      } finally {
        sendInFlightRef.current = false;
        setIsSending(false);
      }
    },
    [ensureSessionId, isLoggedIn, lgpdAccepted, visitorInfo],
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem(FALE_CONOSCO_ACCEPTED_KEY);
    sessionStorage.removeItem(FALE_CONOSCO_VISITOR_KEY);
    localStorage.removeItem(FALE_CONOSCO_SESSION_KEY);
    setLgpdAccepted(false);
    const empty = { name: "", email: "", phone: "" };
    setVisitorInfoState(empty);
    setVisitorDraft(empty);
    setVisitorFormMode("hidden");
    setVisitorFormError(null);
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
    visitorDraft,
    setVisitorDraft,
    visitorFormMode,
    visitorFormError,
    expandVisitorForm,
    saveVisitorForm,
    cancelVisitorForm,
    isSending,
    sendError,
    sendMessage,
    clearConversation,
    isTyping: replyState.isTyping,
    awaitingReply: replyState.awaitingReply,
  };
}
