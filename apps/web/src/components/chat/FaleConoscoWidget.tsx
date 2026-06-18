"use client";

import { useState } from "react";

import { ChatBubble } from "./ChatBubble";
import { ChatModal } from "./ChatModal";

type FaleConoscoWidgetProps = {
  variant: "floating" | "inline-button";
  isLoggedIn?: boolean;
};

export function FaleConoscoWidget({ variant, isLoggedIn = false }: FaleConoscoWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "floating" ? (
        <ChatBubble onClick={() => setOpen(true)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="chat-inline-button"
          className="bg-black px-8 py-4 text-base font-semibold text-white transition hover:bg-zinc-800"
        >
          Fale Conosco
        </button>
      )}

      <ChatModal open={open} onClose={() => setOpen(false)} isLoggedIn={isLoggedIn} />
    </>
  );
}
