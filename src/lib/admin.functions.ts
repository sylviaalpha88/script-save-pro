import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const usernameToEmail = (u: string) => `${u.toLowerCase().trim()}@lemsa.local`;

// Public: ensure the seeded admin account exists. Idempotent.
export const ensureAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = usernameToEmail("Admin");

  // Check profile
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", "Admin")
    .maybeSingle();
  if (existing) return { ok: true };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "123456789",
    email_confirm: true,
    user_metadata: { username: "Admin" },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Failed to create admin");

  const { error: pErr } = await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    username: "Admin",
    role: "admin",
  });
  if (pErr) throw new Error(pErr.message);
  return { ok: true };
});

// Resolve username -> email so the login form can call supabase.auth.signInWithPassword
export const resolveUsername = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string }) => z.object({ username: z.string().min(1).max(50) }).parse(d))
  .handler(async ({ data }) => {
    return { email: usernameToEmail(data.username) };
  });

// Admin creates staff users
export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; password: string; role: "pharmacy" | "inventory" }) =>
    z.object({
      username: z.string().min(2).max(50),
      password: z.string().min(6).max(100),
      role: z.enum(["pharmacy", "inventory"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

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
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(pErr.message);
    }
    return { ok: true };
  });

export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    await supabaseAdmin.auth.admin.deleteUser(data.userId);
    return { ok: true };
  });
