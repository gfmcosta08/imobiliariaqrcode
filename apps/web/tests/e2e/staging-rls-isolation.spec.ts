import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type TenantFixture = {
  email: string;
  password: string;
  userId: string;
  accountId: string;
  brokerId: string;
  propertyId: string;
  mediaId: string;
  qrId: string;
  leadId: string;
  interactionId: string;
  activationEventId: string;
  importJobId: string;
};

function adminClient(): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function userClient(): SupabaseClient {
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
}

async function ensureTenant(admin: SupabaseClient, label: "a" | "b"): Promise<TenantFixture> {
  const email = `rls.${label}.${runId}@teste.com`;
  const password = `TesteRLS123!${label}${runId.slice(-4)}`;
  const whatsapp = `5599${Date.now().toString().slice(-8)}${label === "a" ? "1" : "2"}`;

  const { data: auth, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `RLS Tenant ${label.toUpperCase()}`,
      whatsapp_number: whatsapp,
    },
  });
  expect(authError, authError?.message).toBeFalsy();
  const userId = auth.user?.id;
  expect(userId).toBeTruthy();

  const { data: profile } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();

  let accountId = profile?.account_id as string | undefined;
  if (!accountId) {
    const { data: account, error } = await admin.from("accounts").insert({}).select("id").single();
    expect(error, error?.message).toBeFalsy();
    accountId = account!.id as string;
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        account_id: accountId,
        email,
        full_name: `RLS Tenant ${label.toUpperCase()}`,
        whatsapp_number: whatsapp,
        role: "broker",
      },
      { onConflict: "id" },
    );
    expect(profileError, profileError?.message).toBeFalsy();
  }

  const { data: existingBroker } = await admin
    .from("brokers")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  let brokerId = existingBroker?.id as string | undefined;
  if (!brokerId) {
    const { data: broker, error } = await admin
      .from("brokers")
      .insert({
        account_id: accountId,
        profile_id: userId,
        display_name: `RLS Tenant ${label.toUpperCase()}`,
        whatsapp_number: whatsapp,
      })
      .select("id")
      .single();
    expect(error, error?.message).toBeFalsy();
    brokerId = broker!.id as string;
  }

  await admin.from("subscriptions").upsert(
    {
      account_id: accountId,
      plan_code: "free",
      status: "free",
    },
    { onConflict: "account_id" },
  );

  const { data: property, error: propertyError } = await admin
    .from("properties")
    .insert({
      account_id: accountId,
      broker_id: brokerId,
      origin_plan_code: "free",
      listing_status: "published",
      property_type: "Residencial",
      property_subtype: "Apartamento",
      purpose: "sale",
      title: `RLS Property ${label.toUpperCase()} ${runId}`,
      description: "Registro sintetico para teste hostil de RLS.",
      city: "Palmas",
      state: "TO",
    })
    .select("id")
    .single();
  expect(propertyError, propertyError?.message).toBeFalsy();

  const propertyId = property!.id as string;

  const { data: media, error: mediaError } = await admin
    .from("property_media")
    .insert({
      property_id: propertyId,
      storage_path: `account/${accountId}/rls-${runId}-${label}.png`,
      mime_type: "image/png",
      sort_order: 0,
      is_primary: true,
      status: "ready",
    })
    .select("id")
    .single();
  expect(mediaError, mediaError?.message).toBeFalsy();

  const { data: qr, error: qrError } = await admin
    .from("property_qrcodes")
    .insert({
      property_id: propertyId,
      qr_token: `rls-${runId}-${label}`,
      is_active: true,
    })
    .select("id")
    .single();
  expect(qrError, qrError?.message).toBeFalsy();

  const leadPhone = `5598${Date.now().toString().slice(-8)}${label === "a" ? "3" : "4"}`;
  const { data: lead, error: leadError } = await admin
    .from("leads")
    .insert({
      property_id: propertyId,
      broker_id: brokerId,
      client_phone: leadPhone,
      nome_completo: `Lead ${label.toUpperCase()} ${runId}`,
      primeiro_nome: `Lead ${label.toUpperCase()}`,
      telefone: leadPhone,
      source: "qr_whatsapp",
      intent: "visit_interest",
      status: "new",
    })
    .select("id")
    .single();
  expect(leadError, leadError?.message).toBeFalsy();

  const { data: interaction, error: interactionError } = await admin
    .from("lead_interactions")
    .insert({
      lead_id: lead!.id,
      interaction_type: "rls_test",
      payload: { runId, label },
    })
    .select("id")
    .single();
  expect(interactionError, interactionError?.message).toBeFalsy();

  const { data: activation, error: activationError } = await admin
    .from("activation_events")
    .insert({
      account_id: accountId,
      profile_id: userId,
      event_name: "first_property_created",
      entity_type: "property",
      entity_id: propertyId,
    })
    .select("id")
    .single();
  expect(activationError, activationError?.message).toBeFalsy();

  const { data: importJob, error: importError } = await admin
    .from("property_import_jobs")
    .insert({
      account_id: accountId,
      broker_id: brokerId,
      origin_plan_code: "free",
      created_by: userId,
      source_url: `https://example.com/rls-${runId}-${label}`,
      mode: "single",
      status: "pending",
    })
    .select("id")
    .single();
  expect(importError, importError?.message).toBeFalsy();

  return {
    email,
    password,
    userId: userId!,
    accountId: accountId!,
    brokerId,
    propertyId,
    mediaId: media!.id as string,
    qrId: qr!.id as string,
    leadId: lead!.id as string,
    interactionId: interaction!.id as string,
    activationEventId: activation!.id as string,
    importJobId: importJob!.id as string,
  };
}

async function signedInClient(fixture: TenantFixture): Promise<SupabaseClient> {
  const client = userClient();
  const { error } = await client.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
  });
  expect(error, error?.message).toBeFalsy();
  return client;
}

async function expectNoRows(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<void> {
  const { data, error } = await query;
  expect(error, error?.message).toBeFalsy();
  expect(data ?? []).toHaveLength(0);
}

async function cleanupTenant(admin: SupabaseClient, fixture: TenantFixture): Promise<void> {
  const deletes = [
    admin.from("lead_interactions").delete().eq("id", fixture.interactionId),
    admin.from("leads").delete().eq("id", fixture.leadId),
    admin.from("activation_events").delete().eq("id", fixture.activationEventId),
    admin.from("property_import_jobs").delete().eq("id", fixture.importJobId),
    admin.from("property_media").delete().eq("id", fixture.mediaId),
    admin.from("property_qrcodes").delete().eq("id", fixture.qrId),
    admin.from("properties").delete().eq("id", fixture.propertyId),
    admin.from("brokers").delete().eq("id", fixture.brokerId),
    admin.from("subscriptions").delete().eq("account_id", fixture.accountId),
    admin.from("profiles").delete().eq("id", fixture.userId),
    admin.from("accounts").delete().eq("id", fixture.accountId),
  ];

  for (const deleteQuery of deletes) {
    const { error } = await deleteQuery;
    expect(error, error?.message).toBeFalsy();
  }

  const { error: userDeleteError } = await admin.auth.admin.deleteUser(fixture.userId);
  expect(userDeleteError, userDeleteError?.message).toBeFalsy();
}

test.describe("staging RLS tenant isolation", () => {
  test.beforeEach(() => {
    test.skip(!writeEnabled, "Defina E2E_STAGING_WRITE=1 para criar dados hostis de QA.");
    test.skip(!supabaseUrl || !anonKey || !serviceRoleKey, "Defina Supabase staging envs.");
  });

  test("authenticated account cannot read or mutate another account's records", async () => {
    const admin = adminClient();
    const fixtures: TenantFixture[] = [];
    const storagePathsToCleanup: string[] = [];

    try {
      const tenantA = await ensureTenant(admin, "a");
      const tenantB = await ensureTenant(admin, "b");
      fixtures.push(tenantA, tenantB);

      const clientA = await signedInClient(tenantA);

      const { data: ownProperty, error: ownError } = await clientA
        .from("properties")
        .select("id")
        .eq("id", tenantA.propertyId);
      expect(ownError, ownError?.message).toBeFalsy();
      expect(ownProperty ?? []).toHaveLength(1);

      await expectNoRows(clientA.from("accounts").select("id").eq("id", tenantB.accountId));
      await expectNoRows(
        clientA.from("subscriptions").select("id").eq("account_id", tenantB.accountId),
      );
      await expectNoRows(clientA.from("properties").select("id").eq("id", tenantB.propertyId));
      await expectNoRows(clientA.from("property_media").select("id").eq("id", tenantB.mediaId));
      await expectNoRows(clientA.from("property_qrcodes").select("id").eq("id", tenantB.qrId));
      await expectNoRows(clientA.from("leads").select("id").eq("id", tenantB.leadId));
      await expectNoRows(
        clientA.from("lead_interactions").select("id").eq("id", tenantB.interactionId),
      );
      await expectNoRows(
        clientA.from("activation_events").select("id").eq("id", tenantB.activationEventId),
      );
      await expectNoRows(
        clientA.from("property_import_jobs").select("id").eq("id", tenantB.importJobId),
      );

      await expectNoRows(
        clientA
          .from("properties")
          .update({ title: `RLS breached ${runId}` })
          .eq("id", tenantB.propertyId)
          .select("id"),
      );
      await expectNoRows(
        clientA.from("leads").update({ status: "closed" }).eq("id", tenantB.leadId).select("id"),
      );

      const ownPlan = await clientA.rpc("get_active_plan_code", {
        p_account_id: tenantA.accountId,
      });
      expect(ownPlan.error, ownPlan.error?.message).toBeFalsy();
      expect(ownPlan.data).toBe("free");

      for (const rpcName of [
        "get_active_plan_code",
        "account_property_limit",
        "can_create_property",
      ] as const) {
        const crossTenantRpc = await clientA.rpc(rpcName, { p_account_id: tenantB.accountId });
        expect(crossTenantRpc.error?.message ?? "").toContain("account scope violation");
      }

      const globalMetrics = await clientA.rpc("get_global_dashboard_metrics");
      expect(globalMetrics.error?.message ?? "").toMatch(/permission denied/i);

      const directRouting = await clientA.rpc("assign_premium_lead_recipient", {
        p_account_id: tenantB.accountId,
        p_origin_broker_id: tenantB.brokerId,
        p_property_id: tenantB.propertyId,
        p_lead_id: tenantB.leadId,
        p_qr_code_id: tenantB.qrId,
      });
      expect(directRouting.error?.message ?? "").toMatch(/permission denied/i);

      const pngFixture = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lKf1XwAAAABJRU5ErkJggg==",
        "base64",
      );
      const ownStoragePath = `account/${tenantA.accountId}/rls-storage-${runId}.png`;
      const crossStoragePath = `account/${tenantB.accountId}/rls-storage-${runId}.png`;

      const ownUpload = await clientA.storage
        .from("property-media")
        .upload(ownStoragePath, pngFixture, { contentType: "image/png", upsert: false });
      expect(ownUpload.error, ownUpload.error?.message).toBeFalsy();
      storagePathsToCleanup.push(ownStoragePath);

      const crossUpload = await clientA.storage
        .from("property-media")
        .upload(crossStoragePath, pngFixture, { contentType: "image/png", upsert: false });
      expect(crossUpload.error?.message ?? "").toMatch(/row-level security|violates/i);

      const ownList = await clientA.storage
        .from("property-media")
        .list(`account/${tenantA.accountId}`, { limit: 20 });
      expect(ownList.error, ownList.error?.message).toBeFalsy();
      expect(ownList.data?.some((file) => file.name === `rls-storage-${runId}.png`)).toBe(true);

      const crossList = await clientA.storage
        .from("property-media")
        .list(`account/${tenantB.accountId}`, { limit: 20 });
      expect(crossList.error, crossList.error?.message).toBeFalsy();
      expect(crossList.data ?? []).toHaveLength(0);
    } finally {
      if (storagePathsToCleanup.length > 0) {
        await admin.storage.from("property-media").remove(storagePathsToCleanup);
      }
      for (const fixture of fixtures) {
        await cleanupTenant(admin, fixture);
      }
    }
  });
});
