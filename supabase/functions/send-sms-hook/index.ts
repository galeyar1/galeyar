// Supabase "Send SMS" Auth Hook.
//
// Supabase's built-in Phone Auth (auth.signInWithOtp / auth.verifyOtp) already
// generates the OTP, stores it, rate-limits it, and issues a real session +
// refresh token on success. The only piece it can't do for Iranian farmers is
// deliver the SMS itself — Twilio/MessageBird/Vonage are unreliable under
// sanctions. This hook is Supabase's supported extension point for swapping
// in a local provider: Supabase calls this function with the phone + OTP
// right before sending, and we deliver it via Kavenegar instead.
//
// Wiring: Dashboard → Authentication → Hooks → "Send SMS hook", or the
// [auth.hook.send_sms] section in supabase/config.toml. Verify the exact
// config keys against your Supabase CLI version before deploying — this
// area of the CLI schema has changed across releases.
//
// Required secrets (`supabase secrets set ...`):
//   SEND_SMS_HOOK_SECRET  — the signing secret Supabase shows when you
//                           enable the hook (verifies the request really
//                           came from Supabase Auth).
//   KAVENEGAR_API_KEY     — from https://panel.kavenegar.com
//   KAVENEGAR_OTP_TEMPLATE — the Verify Lookup template name you configured
//                            in the Kavenegar panel for the OTP message.

import { Webhook } from "npm:standardwebhooks@1.0.0";

interface SendSmsHookPayload {
  user: { phone: string };
  sms: { otp: string };
}

function toKavenegarReceptor(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.startsWith("98")) {
    return `0${digitsOnly.slice(2)}`;
  }
  if (digitsOnly.startsWith("0")) {
    return digitsOnly;
  }
  return `0${digitsOnly}`;
}

Deno.serve(async (req) => {
  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  const kavenegarApiKey = Deno.env.get("KAVENEGAR_API_KEY");
  const kavenegarTemplate = Deno.env.get("KAVENEGAR_OTP_TEMPLATE");

  if (!hookSecret || !kavenegarApiKey || !kavenegarTemplate) {
    console.error("send-sms-hook: missing required secrets");
    return new Response(JSON.stringify({ error: "server misconfigured" }), {
      status: 500,
    });
  }

  const rawBody = await req.text();
  const wh = new Webhook(hookSecret);

  let event: SendSmsHookPayload;
  try {
    event = wh.verify(rawBody, Object.fromEntries(req.headers)) as SendSmsHookPayload;
  } catch (error) {
    console.error("send-sms-hook: signature verification failed", error);
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
    });
  }

  const receptor = toKavenegarReceptor(event.user.phone);
  const kavenegarUrl = new URL(
    `https://api.kavenegar.com/v1/${kavenegarApiKey}/verify/lookup.json`
  );
  kavenegarUrl.searchParams.set("receptor", receptor);
  kavenegarUrl.searchParams.set("token", event.sms.otp);
  kavenegarUrl.searchParams.set("template", kavenegarTemplate);

  const kavenegarResponse = await fetch(kavenegarUrl.toString());
  if (!kavenegarResponse.ok) {
    console.error(
      "send-sms-hook: Kavenegar delivery failed",
      kavenegarResponse.status,
      await kavenegarResponse.text()
    );
    return new Response(JSON.stringify({ error: "sms delivery failed" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
