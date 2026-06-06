import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test.setTimeout(210_000);

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const stripeEnabled = process.env.E2E_STRIPE_CHECKOUT === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const brokerEmail = `stripe.failed.qa.${runId}@teste.com`;
const brokerPassword = `TesteQA123!${runId.slice(-4)}`;
const brokerWhatsapp = `1197${runId.slice(-8)}`;

type WebhookRow = {
  external_event_id: string;
  processing_status: string;
  payload: unknown;
};

function requireStripeStaging() {
  test.skip(!baseURL, "Defina STAGING_BASE_URL para rodar E2E no staging.");
  test.skip(!writeEnabled, "Defina E2E_STAGING_WRITE=1 para permitir criacao de dados de QA.");
  test.skip(!stripeEnabled, "Defina E2E_STRIPE_CHECKOUT=1 para checkout Stripe real.");
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Defina Supabase staging service role para verificar webhook.",
  );
  test.skip(/production|prod|imoveisqr\.com/i.test(baseURL), "Base URL parece producao.");
  expect(baseURL).toContain("farollimoveis-staging");
}

function adminClient(): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function signupBroker(page: Page, admin: SupabaseClient): Promise<string> {
  const signup = await page.request.post("/api/auth/signup", {
    data: {
      email: brokerEmail,
      password: brokerPassword,
      fullName: "Corretor QA Stripe Falha",
      whatsapp: brokerWhatsapp,
      acceptedLegal: true,
    },
  });
  expect(signup.status()).toBeLessThan(500);

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("profiles")
          .select("account_id")
          .eq("email", brokerEmail)
          .maybeSingle();
        return (data?.account_id as string | undefined) ?? "";
      },
      { timeout: 60_000 },
    )
    .toMatch(/^[0-9a-f-]{36}$/);

  const { data } = await admin
    .from("profiles")
    .select("account_id")
    .eq("email", brokerEmail)
    .maybeSingle();
  expect(data?.account_id).toBeTruthy();

  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(brokerEmail);
  await page.getByTestId("login-password").fill(brokerPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  return data!.account_id as string;
}

async function waitForFailedWebhook(admin: SupabaseClient, accountId: string): Promise<WebhookRow> {
  const deadline = Date.now() + 150_000;
  let found: WebhookRow | null = null;

  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from("webhook_events")
      .select("external_event_id, processing_status, payload, received_at")
      .eq("provider", "stripe")
      .eq("event_name", "invoice.payment_failed")
      .order("received_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    found =
      (data as WebhookRow[] | null)?.find((row) =>
        JSON.stringify(row.payload).includes(accountId),
      ) ?? null;
    if (found?.processing_status === "processed") return found;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  expect(found, "invoice.payment_failed webhook for account").toBeTruthy();
  expect(found?.processing_status).toBe("processed");
  return found!;
}

test("Stripe Test Clock gera invoice.payment_failed e assinatura past_due", async ({ page }) => {
  requireStripeStaging();

  const admin = adminClient();
  const accountId = await signupBroker(page, admin);
  const trigger = await page.evaluate(async () => {
    const res = await fetch("/api/qa/stripe/payment-failed", { method: "POST" });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body };
  });
  expect(trigger.status).toBe(200);
  expect(trigger.body).toMatchObject({ ok: true, account_id: accountId });

  const webhook = await waitForFailedWebhook(admin, accountId);

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("subscriptions")
          .select("status")
          .eq("account_id", accountId)
          .maybeSingle();
        return (data?.status as string | undefined) ?? "";
      },
      { timeout: 60_000 },
    )
    .toBe("past_due");

  const triggerBody = trigger.body as {
    test_clock_id: string;
    stripe_subscription_id: string;
  };
  console.log(`STRIPE_TEST_CLOCK_ID=${triggerBody.test_clock_id}`);
  console.log(`STRIPE_FAILED_SUBSCRIPTION_ID=${triggerBody.stripe_subscription_id}`);
  console.log(`STRIPE_PAYMENT_FAILED_EVENT_ID=${webhook.external_event_id}`);
});
