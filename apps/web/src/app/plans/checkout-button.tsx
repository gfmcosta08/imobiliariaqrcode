"use client";

import { useState } from "react";

type Props = {
  label: string;
  className?: string;
};

export function CheckoutButton({ label, className }: Props) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => setMessage("Checkout online indisponivel no momento.")}
        className={className}
      >
        {label}
      </button>
      {message && <p className="mt-2 text-xs text-amber-700">{message}</p>}
    </div>
  );
}
