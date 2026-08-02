import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DIRECTOR_EMAIL = "marklemkou@gmail.com";
const DIRECTOR_PASSWORD = "@M0704934570l";

// Convert what the user typed into an email Supabase can authenticate.
// If they typed an email (contains '@'), use it as-is; otherwise append the local suffix.
const usernameToEmail = (u: string) => {
  const v = u.trim();
  return v.includes("@") ? v.toLowerCase() : `${v.toLowerCase()}@lemsa.local`;
};

// Public: ensure the seeded Director account exists. Idempotent.
export const ensureDirector = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", DIRECTOR_EMAIL)
    .maybeSingle();
  if (existing) return { ok: true };

  // Maybe the auth user exists but profile missing
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  let userId = list?.users.find((u) => u.email?.toLowerCase() === DIRECTOR_EMAIL)?.id;

  if (!userId) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: DIRECTOR_EMAIL,
      password: DIRECTOR_PASSWORD,
      email_confirm: true,
      user_metadata: { username: DIRECTOR_EMAIL },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create director");
    userId = created.user.id;
  }

  const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    username: DIRECTOR_EMAIL,
    role: "admin",
    is_director: true,
    can_edit_site: true,
    pharmacy_id: null,
  });
  if (pErr) throw new Error(pErr.message);
  return { ok: true };
});

// Resolve username -> email
export const resolveUsername = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string }) =>
    z.object({ username: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    return { email: usernameToEmail(data.username) };
  });

// =============== DIRECTOR ACTIONS ===============

async function assertDirector(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("is_director")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_director) throw new Error("Director access required");
}

export const createPharmacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().min(2).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("pharmacies")
      .insert({ name: data.name.trim() })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePharmacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find profiles tied to this pharmacy and delete the auth users
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("pharmacy_id", data.id);
    for (const p of profs ?? []) {
      await supabaseAdmin.auth.admin.deleteUser(p.id).catch(() => {});
    }
    const { error } = await supabaseAdmin.from("pharmacies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Director creates an Admin for a specific pharmacy
export const createPharmacyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    pharmacyId: string; username: string; password: string; canEditSite: boolean;
    atUsername?: string; atApiKey?: string; atSenderId?: string;
  }) => z.object({
    pharmacyId: z.string().uuid(),
    username: z.string().min(2).max(50),
    password: z.string().min(6).max(100),
    canEditSite: z.boolean(),
    atUsername: z.string().max(120).optional().nullable(),
    atApiKey: z.string().max(500).optional().nullable(),
    atSenderId: z.string().max(30).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create admin");
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: data.username,
      role: "admin",
      pharmacy_id: data.pharmacyId,
      can_edit_site: data.canEditSite,
      is_director: false,
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(pErr.message);
    }

    // Optionally seed Africa's Talking credentials for this pharmacy
    const atUser = data.atUsername?.trim();
    const atKey = data.atApiKey?.trim();
    if (atUser && atKey) {
      const { data: existing } = await supabaseAdmin
        .from("sms_settings").select("id").eq("pharmacy_id", data.pharmacyId).maybeSingle();
      const payload = {
        provider: "africastalking",
        at_username: atUser,
        at_api_key: atKey,
        sender_id: data.atSenderId?.trim() || null,
        pharmacy_id: data.pharmacyId,
        updated_by: context.userId,
      };
      if (existing?.id) {
        await supabaseAdmin.from("sms_settings").update(payload).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("sms_settings").insert(payload);
      }
    }
    return { ok: true };
  });

export const updateAdminPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; canEditSite: boolean }) =>
    z.object({ userId: z.string().uuid(), canEditSite: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ can_edit_site: data.canEditSite })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePharmacyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    await supabaseAdmin.auth.admin.deleteUser(data.userId).catch(() => {});
    return { ok: true };
  });

// =============== ADMIN ACTIONS (own pharmacy) ===============

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; password: string; role: "pharmacy" | "inventory" | "accountant" | "order_track"; access?: string[] }) =>
    z.object({
      username: z.string().min(2).max(50),
      password: z.string().min(6).max(100),
      role: z.enum(["pharmacy", "inventory", "accountant", "order_track"]),
      access: z.array(z.string().max(30)).max(20).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("role, pharmacy_id, is_director")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me || me.role !== "admin" || me.is_director) throw new Error("Pharmacy Admin only");
    if (!me.pharmacy_id) throw new Error("Your account is not linked to a pharmacy");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed");
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: data.username,
      role: data.role,
      pharmacy_id: me.pharmacy_id,
      access: data.access ?? [],
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(pErr.message);
    }
    return { ok: true };
  });

export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("role, pharmacy_id, is_director")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!me.is_director) {
      // Pharmacy admin can only delete own-pharmacy non-admin staff
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("pharmacy_id, role")
        .eq("id", data.userId)
        .maybeSingle();
      if (!target || target.pharmacy_id !== me.pharmacy_id || target.role === "admin") {
        throw new Error("Forbidden");
      }
    }
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    await supabaseAdmin.auth.admin.deleteUser(data.userId).catch(() => {});
    return { ok: true };
  });

// Delete a wholesale buyer account (auth user + wholesale_buyers row cascades the orders)
export const deleteBuyerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { buyerId: string }) =>
    z.object({ buyerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("role, pharmacy_id, is_director")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me || (me.role !== "admin" && me.role !== "pharmacy")) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: buyer } = await supabaseAdmin
      .from("wholesale_buyers")
      .select("id, user_id, pharmacy_id")
      .eq("id", data.buyerId)
      .maybeSingle();
    if (!buyer) throw new Error("Buyer not found");
    if (!me.is_director && buyer.pharmacy_id !== me.pharmacy_id) throw new Error("Forbidden");

    await supabaseAdmin.from("wholesale_buyers").delete().eq("id", buyer.id);
    if (buyer.user_id) {
      await supabaseAdmin.from("profiles").delete().eq("id", buyer.user_id);
      await supabaseAdmin.auth.admin.deleteUser(buyer.user_id).catch(() => {});
    }
    return { ok: true };
  });

/** Pharmacy Admin updates which modules one of their staff can open. */
export const updateStaffAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; access: string[] }) =>
    z.object({
      userId: z.string().uuid(),
      access: z.array(z.string().max(30)).max(20),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("role, pharmacy_id, is_director").eq("id", context.userId).maybeSingle();
    if (!me || me.role !== "admin" || me.is_director) throw new Error("Pharmacy Admin only");
    if (!me.pharmacy_id) throw new Error("Your account is not linked to a pharmacy");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles").select("id, pharmacy_id, role").eq("id", data.userId).maybeSingle();
    if (!target || target.pharmacy_id !== me.pharmacy_id) throw new Error("Forbidden");
    if (target.role === "admin") throw new Error("Cannot change another admin");

    const { error } = await supabaseAdmin.from("profiles").update({ access: data.access }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
