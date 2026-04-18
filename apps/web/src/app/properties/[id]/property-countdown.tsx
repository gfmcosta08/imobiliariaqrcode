"use client";

import { useEffect, useMemo, useState } from "react";

function pad(value: number): string {
  return String(Math.max(0, value)).padStart(2, "0");
}

function diff(targetIso: string) {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const deltaMs = Math.max(0, target - now);
  const totalSec = Math.floor(deltaMs / 1000);

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { days, hours, minutes, seconds, isExpired: target <= now };
}

type CountdownProps = {
  expiresAt: string;
};

export function PropertyCountdown({ expiresAt }: CountdownProps) {
  const [tick, setTick] = useState(() => diff(expiresAt));

  useEffect(() => {
    setTick(diff(expiresAt));
    const timer = window.setInterval(() => {
      setTick(diff(expiresAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const label = useMemo(() => {
    if (tick.isExpired) {
      return "Expirado. Salve uma edicao para gerar novo QR e reiniciar 30 dias.";
    }
    return "Validade ativa do anuncio";
  }, [tick.isExpired]);

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Contagem regressiva</p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{tick.days}</p>
          <p className="text-xs text-zinc-500">dias</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{pad(tick.hours)}</p>
          <p className="text-xs text-zinc-500">horas</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{pad(tick.minutes)}</p>
          <p className="text-xs text-zinc-500">min</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{pad(tick.seconds)}</p>
          <p className="text-xs text-zinc-500">seg</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{label}</p>
    </div>
  );
}
