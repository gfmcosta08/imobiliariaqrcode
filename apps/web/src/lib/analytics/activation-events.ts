import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVATION_EVENT_NAMES = [
  "account_created",
  "first_property_created",
  "qr_generated",
  "qr_test_opened",
  "lead_received",
  "dashboard_returned",
  "checkout_started",
  "checkout_completed",
  "subscription_canceled",
] as const;

export type ActivationEventName = (typeof ACTIVATION_EVENT_NAMES)[number];

export type ActivationEventInput = {
  account_id: string;
  profile_id?: string | null;
  event_name: ActivationEventName;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
};

export function isActivationEventName(value: string): value is ActivationEventName {
  return (ACTIVATION_EVENT_NAMES as readonly string[]).includes(value);
}

export async function recordActivationEvent(
  admin: SupabaseClient,
  input: ActivationEventInput,
): Promise<void> {
  const eventName = input.event_name?.trim();
  if (!eventName || !isActivationEventName(eventName)) return;

  try {
    await admin.from("activation_events").insert({
      account_id: input.account_id,
      profile_id: input.profile_id ?? null,
      event_name: eventName,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Nao bloqueia fluxo do usuario.
  }
}
