import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export function AppHeader({ active, isAdmin }: { active?: string; isAdmin?: boolean }) {
  const navLinks = [
    { href: "/properties", label: "Imóveis" },
    { href: "/leads", label: "Leads" },
    { href: "/plans", label: "Planos" },
    { href: "/profile", label: "Perfil" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        <Link href="/dashboard">
          <span className="text-sm font-bold uppercase tracking-widest text-gray-900">IMOBQR</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                active === link.href
                  ? "text-sm font-semibold text-gray-900"
                  : "text-sm text-gray-500 transition hover:text-gray-900"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <form action={signOut}>
          <button
            type="submit"
            className="border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:border-gray-500 hover:text-gray-900"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
