import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { assertStripeTestModeAllowed } from "@/lib/stripe-guard";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function subscriptionPeriod(sub: Stripe.Subscription): {
  start: number | null;
  end: number | null;
} {
  const raw = sub as unknown as Record<string, number | undefined>;
  return {
    start: raw.current_period_start ?? null,
    end: raw.current_period_end ?? null,
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as Record<string, unknown>;
  return (
    (raw.subscription as string | null) ??
    ((
      (raw.parent as Record<string, unknown> | null)?.subscription_details as Record<
        string,
        unknown
      > | null
    )?.subscription as string | null) ??
    null
  );
}

async function recordWebhookEvent(
  admin: ReturnType<typeof createServiceRoleClient>,
  event: Stripe.Event,
): Promise<"new" | "duplicate"> {
  const { error } = await admin.from("webhook_events").insert({
    provider: "stripe",
    event_name: event.type,
    external_event_id: event.id,
    payload: event as unknown as Record<string, unknown>,
    processing_status: "pending",
  });

  if (error?.code === "23505") {
    return "duplicate";
  }
  if (error) {
    throw error;
  }
  return "new";
}

async function markWebhookProcessed(
  admin: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  status: "processed" | "failed" | "ignored",
) {
  await admin
    .from("webhook_events")
    .update({ processing_status: status, processed_at: new Date().toISOString() })
    .eq("provider", "stripe")
    .eq("external_event_id", eventId);
}

async function activateStarterSubscription(
  admin: ReturnType<typeof createServiceRoleClient>,
  accountId: string,
  periodStart: number | null,
  periodEnd: number | null,
  stripeSubscriptionId: string | null,
) {
  await admin
    .from("subscriptions")
    .update({
      plan_code: "starter",
      status: "starter_active",
      billing_provider: "stripe",
      provider_subscription_id: stripeSubscriptionId,
      max_active_properties_override: null,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);
}

export async function POST(req: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "webhook_disabled_in_production" }, { status: 503 });
  }

  try {
    assertStripeTestModeAllowed();
  } catch {
    return NextResponse.json({ error: "stripe_test_mode_required" }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "webhook_secret_missing" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const dedupe = await recordWebhookEvent(admin, event);
  if (dedupe === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoiceSubscriptionId(invoice);
        const sub = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
        if (!sub) break;

        const accountId = sub.metadata?.account_id;
        const planCode = sub.metadata?.plan_code;
        if (!accountId || planCode !== "starter") break;

        const period = subscriptionPeriod(sub);
        await activateStarterSubscription(
          admin,
          accountId,
          period.start,
          period.end,
          sub.id,
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoiceSubscriptionId(invoice);
        const sub = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
        if (!sub?.metadata?.account_id) break;

        await admin
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("account_id", sub.metadata.account_id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        if (!accountId) break;

        const period = subscriptionPeriod(sub);
        await admin
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            current_period_end: period.end ? new Date(period.end * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        const planCode = sub.metadata?.plan_code;
        if (!accountId || planCode !== "starter") break;

        const period = subscriptionPeriod(sub);
        const status =
          sub.status === "active" || sub.status === "trialing" ? "starter_active" : "past_due";

        await admin
          .from("subscriptions")
          .update({
            plan_code: "starter",
            status,
            current_period_start: period.start
              ? new Date(period.start * 1000).toISOString()
              : null,
            current_period_end: period.end ? new Date(period.end * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);
        break;
      }

      default:
        await markWebhookProcessed(admin, event.id, "ignored");
        return NextResponse.json({ received: true, ignored: true });
    }

    await markWebhookProcessed(admin, event.id, "processed");
  } catch {
    await markWebhookProcessed(admin, event.id, "failed");
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
