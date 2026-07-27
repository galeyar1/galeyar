import type { PaymentProviderId } from "@/lib/supabase/types";

/**
 * Payment gateway architecture, scaffolded per the v3.0 spec's own
 * IMPORTANT: "Do NOT implement real payment gateways at this stage —
 * prepare the architecture only." Every provider below always resolves to
 * a "coming soon" result; swapping in a real ZarinPal/IDPay/NextPay call
 * later only means implementing `initiate()` for that one provider — the
 * caller (src/app/(app)/subscriptions/page.tsx) doesn't change.
 *
 * Deliberately no `verify()` here: verifying a transaction with the
 * gateway's server API and then flipping payment_transactions.status to
 * "success" MUST happen server-side (a Supabase edge function using
 * SUPABASE_SERVICE_ROLE_KEY, same pattern as supabase/functions/delete-user)
 * and must be idempotent — check the row isn't already "success" before
 * writing, since gateway callbacks/redirects can fire more than once. RLS
 * migration 0023 already blocks a farm owner from setting their own row's
 * status to "success" from the client, which is exactly why this can't
 * live in client-importable code: nothing here should ever be trusted to
 * decide a payment succeeded.
 */

export interface PaymentInitiateResult {
  ok: boolean;
  message: string;
  redirectUrl?: string;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  label: string;
  initiate(amountRial: number, callbackUrl: string): Promise<PaymentInitiateResult>;
}

function comingSoonProvider(id: PaymentProviderId, label: string): PaymentProvider {
  return {
    id,
    label,
    async initiate() {
      return { ok: false, message: `درگاه پرداخت ${label} به‌زودی فعال می‌شود.` };
    },
  };
}

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  comingSoonProvider("zarinpal", "زرین‌پال"),
  comingSoonProvider("idpay", "آی‌دی‌پی"),
  comingSoonProvider("nextpay", "نکست‌پی"),
];

export function paymentProvider(id: PaymentProviderId): PaymentProvider {
  const provider = PAYMENT_PROVIDERS.find((p) => p.id === id);
  if (!provider) throw new Error(`Unknown payment provider: ${id}`);
  return provider;
}
