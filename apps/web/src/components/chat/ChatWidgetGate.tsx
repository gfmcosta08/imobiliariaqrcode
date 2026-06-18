"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { FaleConoscoWidget } from "./FaleConoscoWidget";

function isExcludedRoute(pathname: string, isLoggedIn: boolean): boolean {
  if (isLoggedIn) return false;
  return pathname.startsWith("/admin") || pathname.startsWith("/checkout/payment");
}

export function ChatWidgetGate() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      setReady(true);
      return;
    }

    try {
      const supabase = createClient();
      void supabase.auth.getUser().then(({ data: { user } }) => {
        setIsLoggedIn(Boolean(user));
        setReady(true);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(Boolean(session?.user));
      });

      return () => subscription.unsubscribe();
    } catch {
      setReady(true);
      return undefined;
    }
  }, []);

  if (!ready || isExcludedRoute(pathname, isLoggedIn)) {
    return null;
  }

  return <FaleConoscoWidget variant="floating" isLoggedIn={isLoggedIn} />;
}
