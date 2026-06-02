"use client";

import { useState } from "react";

type Props = {
  className?: string;
};

export function CheckoutButton({ className }: Props) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => setMessage("Checkout online indisponivel no momento.")}
        className={className}
      >
        Checkout indisponivel
      </button>
      {message && <p className="mt-2 text-xs text-amber-700">{message}</p>}
    </div>
  );
}
