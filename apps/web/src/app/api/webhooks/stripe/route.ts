import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Desabilita o bodyParser do Next.js — Stripe precisa do raw body para validar a assinatura
export const runtime = "nodejs";

async function activateSubscription(
  admin: ReturnType<typeof createServiceRoleClient>,
  accountId: string,
  planCode: string,
  periodStart: number | null,
  periodEnd: number | null,
  stripeSubscriptionId: string | null,
) {
  const isSolo = planCode === "solo";
  const status = isSolo ? "solo_active" : "pro_active";

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

  // Para solo: atualizar expires_at do imóvel vinculado (120 dias)
  if (isSolo) {
    await admin
      .from("properties")
      .update({
        listing_status: "published",
        expires_at: new Date(Date.now() + 120 * 86400 * 1000).toISOString(),
        origin_plan_code: "solo",
      })
      .eq("account_id", accountId)
      .in("listing_status", ["expired", "draft"]);
  }
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

  switch (event.type) {
    // ── Checkout concluído ──────────────────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const accountId = session.metadata?.account_id;
      const planCode = session.metadata?.plan_code;
      if (!accountId || !planCode) break;

      if (session.mode === "payment") {
        // Solo: pagamento único
        await activateSubscription(admin, accountId, planCode, null, null, null);
      }
      // Subscription: aguarda invoice.payment_succeeded para ativar
      break;
    }

    // ── Pagamento de fatura aprovado ────────────────────────────────────────
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const sub = invoice.subscription
        ? await stripe.subscriptions.retrieve(invoice.subscription as string)
        : null;
      if (!sub) break;

      const accountId = sub.metadata?.account_id;
      const planCode = sub.metadata?.plan_code;
      if (!accountId || !planCode) break;

      await activateSubscription(
        admin,
        accountId,
        planCode,
        sub.current_period_start,
        sub.current_period_end,
        sub.id,
      );
      break;
    }

    // ── Pagamento falhou ────────────────────────────────────────────────────
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const sub = invoice.subscription
        ? await stripe.subscriptions.retrieve(invoice.subscription as string)
        : null;
      if (!sub) break;

      const accountId = sub.metadata?.account_id;
      if (!accountId) break;

      await admin
        .from("subscriptions")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("account_id", accountId);
      break;
    }

    // ── Assinatura cancelada ou encerrada ───────────────────────────────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const accountId = sub.metadata?.account_id;
      if (!accountId) break;

      await admin
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", accountId);
      break;
    }

    // ── Assinatura atualizada (ex.: upgrade de plano) ───────────────────────
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const accountId = sub.metadata?.account_id;
      const planCode = sub.metadata?.plan_code;
      if (!accountId || !planCode) break;

      const status = sub.status === "active" ? "pro_active" : "past_due";
      await admin
        .from("subscriptions")
        .update({
          plan_code: planCode,
          status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", accountId);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
