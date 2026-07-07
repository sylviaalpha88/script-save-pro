import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Get SMS settings for a specific pharmacy.
 * - Director: can read any pharmacy's row.
 * - Pharmacy admin: can only read their own pharmacy's row.
 * If no pharmacyId is passed, falls back to the caller's own pharmacy.
 */
export const getSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pharmacyId?: string | null } | undefined) =>
    z.object({ pharmacyId: z.string().uuid().nullable().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("role, pharmacy_id, is_director").eq("id", context.userId).maybeSingle();
    if (!me) throw new Error("Not signed in");

    const targetPharmacyId = data.pharmacyId ?? me.pharmacy_id ?? null;
    if (!targetPharmacyId) return null;

    if (!me.is_director) {
      if (me.role !== "admin") throw new Error("Not permitted");
      if (targetPharmacyId !== me.pharmacy_id) throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("sms_settings")
      .select("id, provider, at_username, at_api_key, sender_id, pharmacy_id, updated_at")
      .eq("pharmacy_id", targetPharmacyId)
      .maybeSingle();
    return row ?? null;
  });

/**
 * Save Africa's Talking credentials for a specific pharmacy.
 * - Director: can save for any pharmacy.
 * - Pharmacy admin: only their own pharmacy.
 */
export const saveSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pharmacyId?: string | null; username: string; apiKey: string; senderId?: string | null }) =>
    z.object({
      pharmacyId: z.string().uuid().nullable().optional(),
      username: z.string().min(1).max(120),
      apiKey: z.string().min(10).max(500),
      senderId: z.string().max(30).optional().nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("role, pharmacy_id, is_director").eq("id", context.userId).maybeSingle();
    if (!me) throw new Error("Not signed in");

    const targetPharmacyId = data.pharmacyId ?? me.pharmacy_id ?? null;
    if (!targetPharmacyId) throw new Error("Pharmacy is required");

    if (!me.is_director) {
      if (me.role !== "admin") throw new Error("Not permitted");
      if (targetPharmacyId !== me.pharmacy_id) throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Upsert per pharmacy
    const { data: existing } = await supabaseAdmin
      .from("sms_settings").select("id").eq("pharmacy_id", targetPharmacyId).maybeSingle();

    const payload = {
      provider: "africastalking",
      at_username: data.username.trim(),
      at_api_key: data.apiKey.trim(),
      sender_id: data.senderId?.trim() || null,
      pharmacy_id: targetPharmacyId,
      updated_by: context.userId,
    };

    if (existing?.id) {
      const { error } = await supabaseAdmin.from("sms_settings").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("sms_settings").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/**
 * Staff (admin / pharmacy / accountant) send an SMS to one or more registered buyers.
 * Uses the caller's pharmacy Africa's Talking credentials.
 */
export const sendBulkSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { buyerIds: string[]; body: string }) =>
    z.object({
      buyerIds: z.array(z.string().uuid()).min(1).max(500),
      body: z.string().min(1).max(1000),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("id, role, pharmacy_id, is_director").eq("id", context.userId).maybeSingle();
    if (!me) throw new Error("Not signed in");
    // Director is intentionally NOT allowed to send messages.
    const allowed = !me.is_director && ["admin", "pharmacy", "accountant"].includes(me.role);
    if (!allowed) throw new Error("Not permitted to send messages");
    if (!me.pharmacy_id) throw new Error("Your account is not linked to a pharmacy");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load buyers scoped to caller's pharmacy
    const { data: buyers, error: bErr } = await supabaseAdmin
      .from("wholesale_buyers")
      .select("id, name, phone, pharmacy_id")
      .in("id", data.buyerIds)
      .eq("pharmacy_id", me.pharmacy_id);
    if (bErr) throw new Error(bErr.message);
    const targets = (buyers ?? []).filter(b => b.phone && b.phone.trim());
    if (targets.length === 0) throw new Error("No recipients with a phone number");

    // Credentials for the caller's pharmacy
    const { data: cfg } = await supabaseAdmin
      .from("sms_settings")
      .select("at_username, at_api_key, sender_id")
      .eq("pharmacy_id", me.pharmacy_id)
      .maybeSingle();

    if (!cfg?.at_username || !cfg?.at_api_key) {
      const rows = targets.map(b => ({
        pharmacy_id: b.pharmacy_id,
        sender_id: context.userId,
        buyer_id: b.id,
        recipient_name: b.name,
        recipient_phone: b.phone as string,
        body: data.body,
        status: "failed",
        provider_response: { error: "SMS credentials not configured for this pharmacy." },
      }));
      await supabaseAdmin.from("messages").insert(rows);
      throw new Error("SMS credentials not configured for this pharmacy. Ask your Director or Admin to add Africa's Talking credentials.");
    }

    const normalize = (p: string) => {
      const digits = p.replace(/[^\d+]/g, "");
      if (digits.startsWith("+")) return digits;
      if (digits.startsWith("254")) return "+" + digits;
      if (digits.startsWith("0")) return "+254" + digits.slice(1);
      return "+" + digits;
    };

    const to = targets.map(t => normalize(t.phone!)).join(",");
    const form = new URLSearchParams();
    form.set("username", cfg.at_username);
    form.set("to", to);
    form.set("message", data.body);
    if (cfg.sender_id) form.set("from", cfg.sender_id);

    const endpoint = cfg.at_username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    let providerResponse: any = null;
    let ok = false;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apiKey: cfg.at_api_key,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      providerResponse = await res.json().catch(() => ({ status: res.status, text: "non-json response" }));
      ok = res.ok;
    } catch (e) {
      providerResponse = { error: (e as Error).message };
      ok = false;
    }

    const recipients: Array<{ number: string; status: string; statusCode?: number; cost?: string; messageId?: string }> =
      providerResponse?.SMSMessageData?.Recipients ?? [];

    const rows = targets.map(b => {
      const norm = normalize(b.phone!);
      const rec = recipients.find(r => r.number === norm);
      const sent = ok && (!rec || /success|sent/i.test(rec.status));
      return {
        pharmacy_id: b.pharmacy_id,
        sender_id: context.userId,
        buyer_id: b.id,
        recipient_name: b.name,
        recipient_phone: norm,
        body: data.body,
        status: sent ? "sent" : "failed",
        provider_response: rec ?? providerResponse,
      };
    });
    await supabaseAdmin.from("messages").insert(rows);

    const sentCount = rows.filter(r => r.status === "sent").length;
    return { ok: sentCount > 0, sent: sentCount, total: rows.length, provider: providerResponse };
  });
