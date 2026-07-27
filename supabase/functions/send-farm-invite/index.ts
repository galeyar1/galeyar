// Creates an email-based farm_invites row and sends the invitation email.
//
// The insert itself goes through the CALLER's own JWT (respecting RLS —
// farm_invites_owner_all requires the caller to actually own the target
// farm), same reasoning as delete-user: authorization is the database's
// job, not this function's. The service-role client is used only for the
// side effect the caller's own permissions can never cover — reading the
// farm name for the email body and calling the email provider — never to
// bypass the insert's own authorization.
//
// Required secrets (`supabase secrets set ...`):
//   RESEND_API_KEY   — from https://resend.com/api-keys
//   RESEND_FROM      — verified sender, e.g. "گله‌یار <invites@galeyar.ir>"
//                      (requires a domain verified in Resend — see report)
//   PUBLIC_APP_URL   — e.g. "https://app.galeyar.ir" (used to build the
//                      accept-invite link; falls back to that value below
//                      if unset, so this isn't strictly required)

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resendFrom = Deno.env.get("RESEND_FROM") ?? "گله‌یار <invites@galeyar.ir>";
const appUrl = Deno.env.get("PUBLIC_APP_URL") ?? "https://app.galeyar.ir";

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

const ROLE_LABELS_FA: Record<string, string> = {
  operator: "اپراتور",
  vet: "دامپزشک",
  consultant: "مشاور",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Invalid session" }, 401);

  let body: { farmId?: string; email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { farmId, email, role } = body;
  if (!farmId || !email || !role) return json({ error: "farmId, email, and role are required" }, 400);
  if (!isValidEmail(email)) return json({ error: "ایمیل معتبر نیست" }, 400);
  if (!["operator", "vet", "consultant"].includes(role)) return json({ error: "Invalid role" }, 400);

  // Respects RLS (farm_invites_owner_all) — this is the real authorization
  // check: it fails here if the caller isn't an owner-member of farmId.
  const { data: invite, error: insertError } = await callerClient
    .from("farm_invites")
    .insert({ farm_id: farmId, email: email.toLowerCase(), role, invited_by: callerData.user.id })
    .select("id, token")
    .single();

  if (insertError) {
    const message = insertError.code === "23505"
      ? "دعوت‌نامه‌ی فعالی برای این ایمیل و نقش از قبل وجود دارد."
      : insertError.message;
    return json({ error: message }, insertError.code === "42501" ? 403 : 400);
  }

  if (!resendApiKey) {
    console.error("send-farm-invite: RESEND_API_KEY not configured — invite created but no email sent");
    return json({ success: true, emailSent: false, warning: "email provider not configured" }, 200);
  }

  const { data: farm } = await adminClient.from("farms").select("farm_name").eq("id", farmId).maybeSingle();
  const farmName = farm?.farm_name ?? "گله‌یار";
  const acceptUrl = `${appUrl}/auth/accept-invite?token=${invite.token}`;
  const roleLabel = ROLE_LABELS_FA[role] ?? role;

  const emailHtml = `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #ffffff;">
      <h2 style="color: #1B5E20;">دعوت به گله‌یار</h2>
      <p>شما به عنوان <strong>${roleLabel}</strong> برای همکاری در مزرعه‌ی «<strong>${farmName}</strong>» در گله‌یار دعوت شده‌اید.</p>
      <p style="margin: 24px 0;">
        <a href="${acceptUrl}" style="background: #1B5E20; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
          پذیرفتن دعوت
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">این دعوت تا ۷ روز دیگر معتبر است. اگر این دعوت را درخواست نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید.</p>
    </div>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject: `دعوت به مزرعه‌ی ${farmName} در گله‌یار`,
      html: emailHtml,
    }),
  });

  if (!resendResponse.ok) {
    console.error("send-farm-invite: Resend delivery failed", resendResponse.status, await resendResponse.text());
    return json({ success: true, emailSent: false, warning: "email delivery failed" }, 200);
  }

  return json({ success: true, emailSent: true }, 200);
});
