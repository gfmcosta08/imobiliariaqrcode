import { CHAT_POLL_INTERVAL_MS } from "./types";

/** Intervalo de polling quando a aba está visível. */
export function getChatPollIntervalMs(isDocumentHidden: boolean): number | null {
  if (isDocumentHidden) return null;
  return CHAT_POLL_INTERVAL_MS;
}

/** Agenda próximo tick de polling com timers fake-friendly. */
export function scheduleNextPoll(
  callback: () => void,
  isDocumentHidden: boolean,
  setTimer: typeof setTimeout = setTimeout,
): ReturnType<typeof setTimeout> | null {
  const interval = getChatPollIntervalMs(isDocumentHidden);
  if (interval == null) return null;
  return setTimer(callback, interval);
}
