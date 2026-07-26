// Full account deletion for the Control Center's User Management module.
// Deleting a Supabase Auth user requires the service-role key, which must
// never reach the browser or the admin app's bundle — this function is the
// only place that key is used, and it's injected automatically by the
// Supabase Edge Runtime (never configured/seen by us as plaintext).
//
// Deleting auth.users cascades to public.users (id references auth.users
// on delete cascade); farms/animals/records the deleted user created keep
// existing (created_by columns are "on delete set null"), so no farm data
// is ever lost by removing an account.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  // Identify the caller from their OWN token (not service role) so we act
  // on exactly who they're authenticated as.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Invalid session" }, 401);

  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("role, is_active")
    .eq("id", callerData.user.id)
    .maybeSingle();

  if (!adminRow?.is_active || !["super_admin", "admin"].includes(adminRow.role)) {
    return json({ error: "Forbidden — insufficient admin role" }, 403);
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const targetUserId = body.userId;
  if (!targetUserId || typeof targetUserId !== "string") {
    return json({ error: "userId is required" }, 400);
  }
  if (targetUserId === callerData.user.id) {
    return json({ error: "Cannot delete your own account this way" }, 400);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (deleteError) return json({ error: deleteError.message }, 500);

  await adminClient.from("admin_audit_logs").insert({
    admin_user_id: callerData.user.id,
    action: "delete_user",
    target_type: "user",
    target_id: targetUserId,
  });

  return json({ success: true }, 200);
});
