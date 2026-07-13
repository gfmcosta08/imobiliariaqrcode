"use client";

import { useDraggableBubble } from "./useDraggableBubble";

type ChatBubbleProps = {
  onOpen: () => void;
  unread?: boolean;
};

export function ChatBubble({ onOpen, unread }: ChatBubbleProps) {
  const drag = useDraggableBubble({ onTap: onOpen });

  if (!drag.position || !drag.style) return null;

  return (
    <button
      type="button"
      data-testid="chat-floating-bubble"
      aria-label="Abrir Fale Conosco. Arraste para reposicionar."
      className="fixed z-50 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      style={drag.style}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-6 w-6 pointer-events-none"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.135 3.348 4.122v8.598a2.25 2.25 0 01-2.25 2.25h-5.374a.75.75 0 00-.53.22l-1.984 1.984a.75.75 0 01-1.06 0l-1.984-1.984a.75.75 0 00-.53-.22H4.25A2.25 2.25 0 012 16.19V6.892c0-1.987 1.37-3.83 3.348-4.122A48.144 48.144 0 0112 2.25z"
          clipRule="evenodd"
        />
      </svg>
      {unread ? (
        <span className="pointer-events-none absolute right-1 top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
      ) : null}
    </button>
  );
}
