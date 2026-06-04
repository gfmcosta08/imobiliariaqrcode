import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { recordActivationEvent } from "@/lib/analytics/activation-events";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

async function activateSubscription(
  admin: ReturnType<typeof createServiceRoleClient>,
  accountId: string,
  planCode: string,
  periodStart: number | null,
  periodEnd: number | null,
  stripeSubscriptionId: string | null,
) {
  const status = planCode === "starter" ? "starter_active" : "pro_active";

  await admin
    .from("subscriptions")
    .update({
      plan_code: planCode,
      status,
      billing_provider: "stripe",
      provider_subscription_id: stripeSubscriptionId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const rawInvoice = invoice as unknown as Record<string, unknown>;
  return (
    (rawInvoice.subscription as string | null) ??
    ((
      (rawInvoice.parent as Record<string, unknown> | null)?.subscription_details as Record<
        string,
        unknown
      > | null
    )?.subscription as string | null) ??
    null
  );
}

function periodFromSubscription(sub: Stripe.Subscription): {
  periodStart: number | null;
  periodEnd: number | null;
} {
  const rawSub = sub as unknown as Record<string, number | undefined>;
  return {
    periodStart: rawSub.current_period_start ?? null,
    periodEnd: rawSub.current_period_end ?? null,
  };
}

async function markWebhookProcessed(
  admin: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  status: "processed" | "failed",
) {
  await admin
    .from("webhook_events")
    .update({
      processing_status: status,
      processed_at: new Date().toISOString(),
    })
    .eq("provider", "stripe")
    .eq("external_event_id", eventId);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET ausente." }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { error: insertError } = await admin.from("webhook_events").insert({
    provider: "stripe",
    event_name: event.type,
    external_event_id: event.id,
    payload: event as unknown as Record<string, unknown>,
    processing_status: "pending",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const accountId = session.metadata?.account_id;
        if (!accountId) break;

        if (session.customer && typeof session.customer === "string") {
          await admin
            .from("accounts")
            .update({
              stripe_customer_id: session.customer,
              updated_at: new Date().toISOString(),
            })
            .eq("id", accountId);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        const sub = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
        if (!sub) break;

        const accountId = sub.metadata?.account_id;
        const planCode = sub.metadata?.plan_code;
        if (!accountId || !planCode) break;

        const { periodStart, periodEnd } = periodFromSubscription(sub);
        await activateSubscription(admin, accountId, planCode, periodStart, periodEnd, sub.id);
        await recordActivationEvent(admin, {
          account_id: accountId,
          event_name: "checkout_completed",
          entity_type: "subscription",
          metadata: { plan_code: planCode },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        const sub = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
        if (!sub) break;

        const accountId = sub.metadata?.account_id;
        if (!accountId) break;

        await admin
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("account_id", accountId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        if (!accountId) break;

        const { periodEnd } = periodFromSubscription(sub);
        await admin
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        const planCode = sub.metadata?.plan_code;
        if (!accountId || !planCode) break;

        const { periodStart, periodEnd } = periodFromSubscription(sub);
        let status: string;
        if (sub.status === "active") {
          status = planCode === "starter" ? "starter_active" : "pro_active";
        } else if (sub.status === "canceled" || sub.status === "unpaid") {
          status = "canceled";
        } else {
          status = "past_due";
        }

        await admin
          .from("subscriptions")
          .update({
            plan_code: planCode,
            status,
            current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);
        break;
      }

      default:
        break;
    }

    await markWebhookProcessed(admin, event.id, "processed");
  } catch (handlerError) {
    await markWebhookProcessed(admin, event.id, "failed");
    const message = handlerError instanceof Error ? handlerError.message : "handler_failed";
    return NextResponse.json({ received: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
