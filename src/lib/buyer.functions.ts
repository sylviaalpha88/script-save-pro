import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public: list pharmacies for the buyer registration page.
export const listPharmaciesPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("pharmacies").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Public: register a wholesale buyer. Creates auth user + profile (role=buyer) + wholesale_buyers row (pending).
export const registerBuyer = createServerFn({ method: "POST" })
  .inputValidator((d: {
    pharmacyId: string;
    name: string;
    idNumber: string;
    phone: string;
    location: string;
    licenseNumber: string;
    email: string;
    password: string;
  }) => z.object({
    pharmacyId: z.string().uuid(),
    name: z.string().min(2).max(120),
    idNumber: z.string().min(2).max(60),
    phone: z.string().min(5).max(40),
    location: z.string().min(2).max(200),
    licenseNumber: z.string().min(2).max(80),
    email: z.string().email().max(200),
    password: z.string().min(6).max(100),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reject if a buyer with that email already exists.
    const { data: existing } = await supabaseAdmin
      .from("wholesale_buyers").select("id").eq("email", data.email.toLowerCase()).maybeSingle();
    if (existing) throw new Error("A buyer account already exists for this email. Please sign in.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.email, role: "buyer" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create account");

    const uid = created.user.id;

    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: uid,
      username: data.email.toLowerCase(),
      role: "buyer",
      pharmacy_id: data.pharmacyId,
      is_director: false,
      can_edit_site: false,
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(pErr.message);
    }

    const { error: bErr } = await supabaseAdmin.from("wholesale_buyers").insert({
      user_id: uid,
      pharmacy_id: data.pharmacyId,
      name: data.name,
      id_number: data.idNumber,
      phone: data.phone,
      location: data.location,
      license_number: data.licenseNumber,
      email: data.email.toLowerCase(),
      status: "pending",
    });
    if (bErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(bErr.message);
    }

    return { ok: true, userId: uid };
  });

// Staff-side: register a buyer from the pharmacy. Skips if email already exists.
export const registerBuyerByStaff = createServerFn({ method: "POST" })
  .inputValidator((d: {
    name: string; idNumber: string; phone: string; location: string;
    licenseNumber: string; email: string; password: string;
  }) => z.object({
    name: z.string().min(2).max(120),
    idNumber: z.string().min(2).max(60),
    phone: z.string().min(5).max(40),
    location: z.string().min(2).max(200),
    licenseNumber: z.string().min(2).max(80),
    email: z.string().email().max(200),
    password: z.string().min(6).max(100),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("wholesale_buyers").select("id").eq("email", data.email.toLowerCase()).maybeSingle();
    if (existing) return { ok: true, existed: true };

    // Re-use registerBuyer logic but we need pharmacy from caller. Done via separate flow.
    throw new Error("Use registerBuyer with pharmacy id from staff context");
  });
