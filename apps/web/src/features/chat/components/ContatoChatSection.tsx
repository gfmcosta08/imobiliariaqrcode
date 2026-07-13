"use client";

import { useEffect, useState } from "react";

import { FaleConoscoWidget } from "./FaleConoscoWidget";
import { createClient } from "@/lib/supabase/client";

export function ContatoChatSection() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) return;

      const supabase = createClient();
      void supabase.auth.getUser().then(({ data: { user } }) => {
        setIsLoggedIn(Boolean(user));
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(Boolean(session?.user));
      });

      return () => subscription.unsubscribe();
    } catch {
      return undefined;
    }
  }, []);

  return <FaleConoscoWidget variant="inline-button" isLoggedIn={isLoggedIn} />;
}
