"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import {
  PROPERTY_SUBTYPES,
  PROPERTY_TYPES,
  CITY_REGIONS,
  SUN_POSITIONS,
} from "@/lib/property-options";
import type { CreatePropertyState } from "./actions";
import { ImageBatchPicker } from "./image-batch-picker";

type PropertyFormInitial = {
  id?: string;
  public_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  title?: string | null;
  internal_code?: string | null;
  property_type?: string | null;
  property_subtype?: string | null;
  purpose?: string | null;
  listing_status?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  full_address?: string | null;
  street_number?: string | null;
  address_complement?: string | null;
  location_map_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  full_description?: string | null;
  highlights?: string | null;
  broker_notes?: string | null;
  sale_price?: number | null;
  rent_price?: number | null;
  condo_fee?: number | null;
  iptu_amount?: number | null;
  other_fees?: number | null;
  accepts_financing?: boolean | null;
  accepts_trade?: boolean | null;
  total_area_m2?: number | null;
  built_area_m2?: number | null;
  land_area_m2?: number | null;
  bedrooms?: number | null;
  suites?: number | null;
  bathrooms?: number | null;
  parking_spaces?: number | null;
  living_rooms?: number | null;
  floors_count?: number | null;
  unit_floor?: number | null;
  is_furnished?: boolean | null;
  furnishing_status?: string | null;
  floor_type?: string | null;
  sun_position?: string | null;
  property_age_years?: number | null;
  features?: string[] | null;
  infrastructure?: string[] | null;
  security_items?: string[] | null;
  key_available?: boolean | null;
  is_occupied?: boolean | null;
  documentation?: string | null;
  technical_details?: string | null;
  construction_type?: string | null;
  finish_standard?: string | null;
  registry_number?: string | null;
  documentation_status?: string | null;
  has_deed?: boolean | null;
  has_registration?: boolean | null;
  nearby_points?: string[] | null;
  distance_to_center_km?: number | null;
  city_region?: string | null;
};

type PropertyEditorFormProps = {
  mode: "create" | "edit";
  initial?: PropertyFormInitial;
  action: (prev: CreatePropertyState, formData: FormData) => Promise<CreatePropertyState>;
};

const inputClass =
  "rounded-none border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950";

function fieldId(name: string): string {
  return `property-${name}`;
}

function testId(name: string): string {
  return `property-${name}`;
}

function SubmitButton(props: { mode: "create" | "edit"; placement?: "top" | "bottom" }) {
  const { pending } = useFormStatus();
  const action = props.mode === "create" ? "create" : "edit";
  const placement = props.placement ?? "bottom";
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid={`property-submit-${action}-${placement}`}
      className="rounded-none bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "Salvando..." : props.mode === "create" ? "Salvar imóvel" : "Salvar alterações"}
    </button>
  );
}

function boolToInput(v?: boolean | null): string {
  if (v === true) return "true";
  if (v === false) return "false";
  return "";
}

function textListToInput(v?: string[] | null): string {
  return (v ?? []).join("\n");
}

function formatCurrencyFromNumber(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatAreaFromNumber(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatDate(v?: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

function furnishingToInput(v?: string | null, legacy?: boolean | null): string {
  if (v === "unfurnished" || v === "semi_furnished" || v === "furnished") return v;
  if (legacy === true) return "furnished";
  if (legacy === false) return "unfurnished";
  return "";
}

function parseNaturalDecimal(raw: string): number | null {
  const cleaned = raw
    .replace(/[R$\s]/g, "")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const dotMatches = cleaned.match(/\./g) ?? [];
  const lastDotGroup = cleaned.split(".").at(-1) ?? "";
  const decimalDot = !hasComma && dotMatches.length === 1 && lastDotGroup.length > 0 && lastDotGroup.length <= 2;
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : decimalDot
      ? cleaned
      : cleaned.replace(/\./g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatCurrencyInput(raw: string): string {
  const value = parseNaturalDecimal(raw);
  if (value == null) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatAreaInput(raw: string): string {
  const value = parseNaturalDecimal(raw);
  if (value == null) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function onCurrencyBlur(e: FormEvent<HTMLInputElement>) {
  const input = e.currentTarget;
  input.value = formatCurrencyInput(input.value);
}

function onAreaBlur(e: FormEvent<HTMLInputElement>) {
  const input = e.currentTarget;
  input.value = formatAreaInput(input.value);
}

function FieldLabel(props: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={props.htmlFor} className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">
        {props.label}
        {props.required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {props.children}
      {props.hint ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{props.hint}</span> : null}
    </label>
  );
}

export function PropertyEditorForm(props: PropertyEditorFormProps) {
  const [state, formAction] = useFormState(props.action, null);
  const initial = props.initial ?? {};

  return (
    <form action={formAction} className="mt-8 space-y-8" data-testid="property-editor-form">
      {props.mode === "edit" && initial.id ? (
        <input type="hidden" name="property_id" value={initial.id} />
      ) : null}

      {state?.error ? (
        <p className="rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      <div className="sticky top-0 z-20 -mx-1 border border-zinc-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Edite os dados do anuncio e salve sem precisar rolar ate o fim.
          </p>
          <SubmitButton mode={props.mode} placement="top" />
        </div>
      </div>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Dados Básicos</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="ID do Imóvel (automático)" htmlFor={fieldId("public_id")}>
            <input
              id={fieldId("public_id")}
              data-testid={testId("public_id")}
              disabled
              value={initial.public_id ?? "Será gerado automaticamente"}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Código Interno" htmlFor={fieldId("internal_code")}>
            <input
              id={fieldId("internal_code")}
              name="internal_code"
              autoComplete="off"
              data-testid={testId("internal_code")}
              defaultValue={initial.internal_code ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Tipo de Imóvel" htmlFor={fieldId("property_type")}>
            <select
              id={fieldId("property_type")}
              name="property_type"
              autoComplete="off"
              data-testid={testId("property_type")}
              defaultValue={initial.property_type ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              {PROPERTY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Subtipo de Imóvel" htmlFor={fieldId("property_subtype")}>
            <select
              id={fieldId("property_subtype")}
              name="property_subtype"
              autoComplete="off"
              data-testid={testId("property_subtype")}
              defaultValue={initial.property_subtype ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              {PROPERTY_SUBTYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Finalidade" htmlFor={fieldId("purpose")}>
            <select
              id={fieldId("purpose")}
              name="purpose"
              autoComplete="off"
              data-testid={testId("purpose")}
              defaultValue={initial.purpose ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="sale">Venda</option>
              <option value="rent">Aluguel</option>
              <option value="season">Temporada</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Status do Imóvel" htmlFor={fieldId("listing_status")}>
            <select
              id={fieldId("listing_status")}
              name="listing_status"
              autoComplete="off"
              data-testid={testId("listing_status")}
              defaultValue={initial.listing_status ?? "draft"}
              className={inputClass}
            >
              <option value="draft">Rascunho</option>
              <option value="published">Disponível</option>
              <option value="removed">Vendido (remover do sistema)</option>
              <option value="printed">Impresso</option>
              <option value="expired">Expirado</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Data de Cadastro">
            <input disabled value={formatDate(initial.created_at)} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Data de Atualização">
            <input disabled value={formatDate(initial.updated_at)} className={inputClass} />
          </FieldLabel>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Anúncio</h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <FieldLabel label="Título do Anúncio" htmlFor={fieldId("title")}>
            <input
              id={fieldId("title")}
              name="title"
              autoComplete="off"
              data-testid={testId("title")}
              defaultValue={initial.title ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Descrição Completa" htmlFor={fieldId("full_description")}>
            <textarea
              id={fieldId("full_description")}
              name="full_description"
              autoComplete="off"
              data-testid={testId("full_description")}
              rows={5}
              defaultValue={initial.full_description ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Diferenciais do Imóvel" htmlFor={fieldId("highlights")}>
            <textarea
              id={fieldId("highlights")}
              name="highlights"
              autoComplete="off"
              data-testid={testId("highlights")}
              rows={3}
              defaultValue={initial.highlights ?? ""}
              className={inputClass}
            />
          </FieldLabel>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Valores</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldLabel label="Preço de Venda" htmlFor={fieldId("sale_price")}>
            <input
              id={fieldId("sale_price")}
              name="sale_price"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("sale_price")}
              defaultValue={formatCurrencyFromNumber(initial.sale_price)}
              onBlur={onCurrencyBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Valor de Aluguel/Temporada" htmlFor={fieldId("rent_price")}>
            <input
              id={fieldId("rent_price")}
              name="rent_price"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("rent_price")}
              defaultValue={formatCurrencyFromNumber(initial.rent_price)}
              onBlur={onCurrencyBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Valor do Condomínio" htmlFor={fieldId("condo_fee")}>
            <input
              id={fieldId("condo_fee")}
              name="condo_fee"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("condo_fee")}
              defaultValue={formatCurrencyFromNumber(initial.condo_fee)}
              onBlur={onCurrencyBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Valor do IPTU" htmlFor={fieldId("iptu_amount")}>
            <input
              id={fieldId("iptu_amount")}
              name="iptu_amount"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("iptu_amount")}
              defaultValue={formatCurrencyFromNumber(initial.iptu_amount)}
              onBlur={onCurrencyBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Outras Taxas">
            <input
              name="other_fees"
              defaultValue={formatCurrencyFromNumber(initial.other_fees)}
              onBlur={onCurrencyBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Aceita Financiamento">
            <select
              name="accepts_financing"
              defaultValue={boolToInput(initial.accepts_financing)}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Aceita Permuta">
            <select
              name="accepts_trade"
              defaultValue={boolToInput(initial.accepts_trade)}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </FieldLabel>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Áreas e Cômodos
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FieldLabel label="Área Total (m²)" htmlFor={fieldId("total_area_m2")}>
            <input
              id={fieldId("total_area_m2")}
              name="total_area_m2"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("total_area_m2")}
              defaultValue={formatAreaFromNumber(initial.total_area_m2)}
              onBlur={onAreaBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Área Construída (m²)" htmlFor={fieldId("built_area_m2")}>
            <input
              id={fieldId("built_area_m2")}
              name="built_area_m2"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("built_area_m2")}
              defaultValue={formatAreaFromNumber(initial.built_area_m2)}
              onBlur={onAreaBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Área do Terreno (m²)">
            <input
              name="land_area_m2"
              defaultValue={formatAreaFromNumber(initial.land_area_m2)}
              onBlur={onAreaBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Número de Quartos" htmlFor={fieldId("bedrooms")}>
            <input
              id={fieldId("bedrooms")}
              name="bedrooms"
              inputMode="numeric"
              autoComplete="off"
              data-testid={testId("bedrooms")}
              defaultValue={initial.bedrooms == null ? "" : String(initial.bedrooms)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Número de Suítes">
            <input
              name="suites"
              defaultValue={initial.suites == null ? "" : String(initial.suites)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Número de Banheiros" htmlFor={fieldId("bathrooms")}>
            <input
              id={fieldId("bathrooms")}
              name="bathrooms"
              inputMode="numeric"
              autoComplete="off"
              data-testid={testId("bathrooms")}
              defaultValue={initial.bathrooms == null ? "" : String(initial.bathrooms)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Número de Vagas de Garagem" htmlFor={fieldId("parking_spaces")}>
            <input
              id={fieldId("parking_spaces")}
              name="parking_spaces"
              inputMode="numeric"
              autoComplete="off"
              data-testid={testId("parking_spaces")}
              defaultValue={initial.parking_spaces == null ? "" : String(initial.parking_spaces)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Número de Salas">
            <input
              name="living_rooms"
              defaultValue={initial.living_rooms == null ? "" : String(initial.living_rooms)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Número de Andares">
            <input
              name="floors_count"
              defaultValue={initial.floors_count == null ? "" : String(initial.floors_count)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Andar do Imóvel">
            <input
              name="unit_floor"
              defaultValue={initial.unit_floor == null ? "" : String(initial.unit_floor)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Mobiliado">
            <select
              name="furnishing_status"
              defaultValue={furnishingToInput(initial.furnishing_status, initial.is_furnished)}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="unfurnished">Não mobiliado</option>
              <option value="semi_furnished">Semi-mobiliado</option>
              <option value="furnished">Mobiliado</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Tipo de Piso">
            <input
              name="floor_type"
              defaultValue={initial.floor_type ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Posição Solar">
            <select
              name="sun_position"
              defaultValue={initial.sun_position ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              {SUN_POSITIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Idade do Imóvel (anos)">
            <input
              name="property_age_years"
              defaultValue={
                initial.property_age_years == null ? "" : String(initial.property_age_years)
              }
              className={inputClass}
            />
          </FieldLabel>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Endereço</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="Endereço Completo" htmlFor={fieldId("full_address")}>
            <input
              id={fieldId("full_address")}
              name="full_address"
              autoComplete="street-address"
              data-testid={testId("full_address")}
              defaultValue={initial.full_address ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Número">
            <input
              name="street_number"
              defaultValue={initial.street_number ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Complemento">
            <input
              name="address_complement"
              defaultValue={initial.address_complement ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Bairro" htmlFor={fieldId("neighborhood")}>
            <input
              id={fieldId("neighborhood")}
              name="neighborhood"
              autoComplete="address-level3"
              data-testid={testId("neighborhood")}
              defaultValue={initial.neighborhood ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Cidade" htmlFor={fieldId("city")}>
            <input
              id={fieldId("city")}
              name="city"
              autoComplete="address-level2"
              data-testid={testId("city")}
              defaultValue={initial.city ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Estado (UF)" htmlFor={fieldId("state")}>
            <input
              id={fieldId("state")}
              name="state"
              autoComplete="address-level1"
              data-testid={testId("state")}
              defaultValue={initial.state ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="CEP">
            <input
              name="postal_code"
              defaultValue={initial.postal_code ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel
            label="Localização do imóvel"
            htmlFor={fieldId("location_map_url")}
            required
            hint="Campo obrigatorio: cole o link de localização do imóvel no mapa, como Google Maps."
          >
            <input
              id={fieldId("location_map_url")}
              name="location_map_url"
              type="url"
              required
              autoComplete="url"
              data-testid={testId("location_map_url")}
              placeholder="https://maps.google.com/..."
              defaultValue={initial.location_map_url ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel
            label="Latitude"
            htmlFor={fieldId("latitude")}
            hint="Campo tecnico opcional. Preencha somente se souber a coordenada."
          >
            <input
              id={fieldId("latitude")}
              name="latitude"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("latitude")}
              defaultValue={initial.latitude == null ? "" : String(initial.latitude)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel
            label="Longitude"
            htmlFor={fieldId("longitude")}
            hint="Campo tecnico opcional. Preencha somente se souber a coordenada."
          >
            <input
              id={fieldId("longitude")}
              name="longitude"
              inputMode="decimal"
              autoComplete="off"
              data-testid={testId("longitude")}
              defaultValue={initial.longitude == null ? "" : String(initial.longitude)}
              className={inputClass}
            />
          </FieldLabel>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Características e Infraestrutura
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <FieldLabel label="Características (uma por linha ou separadas por vírgula)">
            <textarea
              name="features"
              rows={3}
              defaultValue={textListToInput(initial.features)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Infraestrutura (uma por linha ou separadas por vírgula)">
            <textarea
              name="infrastructure"
              rows={3}
              defaultValue={textListToInput(initial.infrastructure)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Segurança (uma por linha ou separadas por vírgula)">
            <textarea
              name="security_items"
              rows={3}
              defaultValue={textListToInput(initial.security_items)}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldLabel label="Chave Disponível">
              <select
                name="key_available"
                defaultValue={boolToInput(initial.key_available)}
                className={inputClass}
              >
                <option value="">Não informado</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Imóvel Ocupado">
              <select
                name="is_occupied"
                defaultValue={boolToInput(initial.is_occupied)}
                className={inputClass}
              >
                <option value="">Não informado</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </FieldLabel>
          </div>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Documentação e Detalhes Técnicos
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="Documentação">
            <textarea
              name="documentation"
              rows={3}
              defaultValue={initial.documentation ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Detalhes Técnicos Avançados">
            <textarea
              name="technical_details"
              rows={3}
              defaultValue={initial.technical_details ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Tipo de Construção">
            <select
              name="construction_type"
              defaultValue={initial.construction_type ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="Alvenaria">Alvenaria</option>
              <option value="Madeira">Madeira</option>
              <option value="Mista">Mista</option>
              <option value="Steel Frame">Steel Frame</option>
              <option value="Container">Container</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Padrão de Acabamento">
            <select
              name="finish_standard"
              defaultValue={initial.finish_standard ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="Alto padrão">Alto padrão</option>
              <option value="Médio padrão">Médio padrão</option>
              <option value="Padrão simples">Padrão simples</option>
              <option value="Alto luxo">Alto luxo</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Matrícula do Imóvel">
            <input
              name="registry_number"
              defaultValue={initial.registry_number ?? ""}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Situação da Documentação">
            <select
              name="documentation_status"
              defaultValue={initial.documentation_status ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="Regular">Regular</option>
              <option value="Irregular">Irregular</option>
              <option value="Em regularização">Em regularização</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Possui Escritura">
            <select
              name="has_deed"
              defaultValue={boolToInput(initial.has_deed)}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Possui Registro">
            <select
              name="has_registration"
              defaultValue={boolToInput(initial.has_registration)}
              className={inputClass}
            >
              <option value="">Não informado</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </FieldLabel>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Localização Estratégica
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="Proximidades (uma por linha ou separadas por vírgula)">
            <textarea
              name="nearby_points"
              rows={3}
              defaultValue={textListToInput(initial.nearby_points)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Distância do Centro (km)">
            <input
              name="distance_to_center_km"
              defaultValue={formatAreaFromNumber(initial.distance_to_center_km)}
              onBlur={onAreaBlur}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Região da Cidade">
            <select
              name="city_region"
              defaultValue={initial.city_region ?? ""}
              className={inputClass}
            >
              <option value="">Não informado</option>
              {CITY_REGIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FieldLabel>
        </div>
      </section>

      <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Observações</h2>
        <FieldLabel label="Observações do Corretor (campo livre)">
          <textarea
            name="broker_notes"
            rows={5}
            defaultValue={initial.broker_notes ?? ""}
            className={inputClass}
          />
        </FieldLabel>
      </section>

      {props.mode === "create" ? (
        <section className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Imagens do Imóvel
          </h2>
          <div className="mt-3">
            <ImageBatchPicker
              inputName="media_files"
              label="Selecione até o limite do seu plano"
              helperText="Clique em Escolher arquivos, selecione varias imagens e depois Salvar imóvel."
              testIdPrefix="property-media-files"
            />
          </div>
        </section>
      ) : null}

      <div className="flex items-center gap-4">
        <SubmitButton mode={props.mode} />
        <p className="text-sm">
          <Link href="/properties" className="text-zinc-600 underline dark:text-zinc-400">
            Cancelar
          </Link>
        </p>
        <p className="text-sm">
          <Link href="/dashboard" className="text-zinc-600 underline dark:text-zinc-400">
            Voltar ao painel
          </Link>
        </p>
      </div>
    </form>
  );
}
