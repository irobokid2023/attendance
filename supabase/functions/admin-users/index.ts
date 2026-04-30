import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) return json({ error: "Forbidden: admin role required" }, 403);

    const { action, payload } = await req.json();

    switch (action) {
      case "list": {
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (error) throw error;
        const ids = data.users.map((u) => u.id);
        const { data: roles } = await admin.from("user_roles").select("user_id, role").in("user_id", ids);
        const { data: profiles } = await admin.from("profiles").select("user_id, full_name").in("user_id", ids);
        const users = data.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          banned_until: (u as any).banned_until ?? null,
          full_name: profiles?.find((p) => p.user_id === u.id)?.full_name ?? "",
          role: roles?.find((r) => r.user_id === u.id)?.role ?? "instructor",
        }));
        return json({ users });
      }
      case "set_role": {
        const { user_id, role } = payload;
        if (!["admin", "instructor"].includes(role)) return json({ error: "Invalid role" }, 400);
        await admin.from("user_roles").delete().eq("user_id", user_id);
        const { error } = await admin.from("user_roles").insert({ user_id, role });
        if (error) throw error;
        return json({ ok: true });
      }
      case "set_banned": {
        const { user_id, banned } = payload;
        const { error } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: banned ? "876000h" : "none",
        });
        if (error) throw error;
        return json({ ok: true });
      }
      case "delete_user": {
        const { user_id } = payload;
        if (user_id === userData.user.id) return json({ error: "Cannot delete yourself" }, 400);
        const { error } = await admin.auth.admin.deleteUser(user_id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "reset_password": {
        const { email, redirect_to } = payload;
        const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: redirect_to });
        if (error) throw error;
        return json({ ok: true });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("admin-users error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
