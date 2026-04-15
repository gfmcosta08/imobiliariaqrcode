/**
 * Normaliza telefone brasileiro para dígitos com DDI 55 (dedupe no banco).
 * Aceita entrada com máscara; rejeita tamanhos inválidos.
 */
export function normalizeBrazilPhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) {
    return null;
  }
  let out = d;
  if (!out.startsWith("55") && (out.length === 10 || out.length === 11)) {
    out = `55${out}`;
  }
  if (!out.startsWith("55")) {
    return null;
  }
  if (out.length < 12 || out.length > 13) {
    return null;
  }
  return out;
}
