import { normalizeBrazilPhone } from "@/lib/phone";

export type VisitorInfo = {
  name: string;
  email: string;
  phone: string;
};

export type VisitorFormMode = "hidden" | "bar" | "expanded";

export function hasVisitorInfo(info: VisitorInfo): boolean {
  return Boolean(info.name.trim() || info.email.trim() || info.phone.trim());
}

export function formatVisitorSummary(info: VisitorInfo): string {
  const parts = [info.name.trim(), info.email.trim(), info.phone.trim()].filter(Boolean);
  return parts.join(" · ");
}

export function validateOptionalVisitorInfo(info: VisitorInfo): string | null {
  const email = info.email.trim();
  const phone = info.phone.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "E-mail invalido. Corrija ou deixe em branco.";
  }
  if (phone && !normalizeBrazilPhone(phone)) {
    return "Telefone invalido. Corrija ou deixe em branco.";
  }
  return null;
}

export function initialVisitorFormMode(info: VisitorInfo): VisitorFormMode {
  return hasVisitorInfo(info) ? "bar" : "hidden";
}
