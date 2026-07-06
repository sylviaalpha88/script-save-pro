import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Director-only: read stored Africa's Talking settings. */
export const getSmsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("is_director").eq("id", context.userId).maybeSingle();
    if (!me?.is_director) throw new Error("Director access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sms_settings")
      .select("id, provider, at_username, at_api_key, sender_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

/** Director-only: save Africa's Talking username + API key + optional sender ID. */
export const saveSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; apiKey: string; senderId?: string }) =>
    z.object({
      username: z.string().min(1).max(120),
      apiKey: z.string().min(10).max(500),
      senderId: z.string().max(30).optional().nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("is_director").eq("id", context.userId).maybeSingle();
    if (!me?.is_director) throw new Error("Director access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Single-row: delete any old rows then insert fresh
    await supabaseAdmin.from("sms_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await supabaseAdmin.from("sms_settings").insert({
      provider: "africastalking",
      at_username: data.username.trim(),
      at_api_key: data.apiKey.trim(),
      sender_id: data.senderId?.trim() || null,
      updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Staff (admin / pharmacy / accountant) send an SMS to one or more registered buyers.
 * Looks up credentials via service role — the client never sees the API key.
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
    const allowed = me.is_director || ["admin", "pharmacy", "accountant"].includes(me.role);
    if (!allowed) throw new Error("Not permitted to send messages");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load buyers (scoped to caller's pharmacy unless director)
    let q = supabaseAdmin.from("wholesale_buyers")
      .select("id, name, phone, pharmacy_id")
      .in("id", data.buyerIds);
    if (!me.is_director && me.pharmacy_id) q = q.eq("pharmacy_id", me.pharmacy_id);
    const { data: buyers, error: bErr } = await q;
    if (bErr) throw new Error(bErr.message);
    const targets = (buyers ?? []).filter(b => b.phone && b.phone.trim());
    if (targets.length === 0) throw new Error("No recipients with a phone number");

    // Load credentials
    const { data: cfg } = await supabaseAdmin
      .from("sms_settings")
      .select("at_username, at_api_key, sender_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pharmacyId = me.is_director ? (targets[0]?.pharmacy_id ?? null) : me.pharmacy_id;

    if (!cfg?.at_username || !cfg?.at_api_key) {
      // Log as failed but with a clear reason (so director sees it needs configuring).
      const rows = targets.map(b => ({
        pharmacy_id: b.pharmacy_id,
        sender_id: context.userId,
        buyer_id: b.id,
        recipient_name: b.name,
        recipient_phone: b.phone,
        body: data.body,
        status: "failed",
        provider_response: { error: "SMS settings not configured. Ask the Director to add Africa's Talking username and API key." },
      }));
      await supabaseAdmin.from("messages").insert(rows);
      throw new Error("SMS provider not configured. Ask the Director to add Africa's Talking credentials.");
    }

    // Normalize phone numbers to E.164-ish (assume Kenya +254 if starts with 0)
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

    // Sandbox vs live: username "sandbox" hits the sandbox endpoint.
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
    return { ok: sentCount > 0, sent: sentCount, total: rows.length, provider: providerResponse, pharmacyId };
  });
