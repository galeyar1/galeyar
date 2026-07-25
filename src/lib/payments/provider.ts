import type { PaymentProviderId } from "@/lib/supabase/types";

/**
 * Payment gateway architecture, scaffolded per the v3.0 spec's own
 * IMPORTANT: "Do NOT implement real payment gateways at this stage —
 * prepare the architecture only." Every provider below always resolves to
 * a "coming soon" result; swapping in a real ZarinPal/IDPay/NextPay call
 * later only means implementing `initiate`/`verify` for that one provider —
 * callers (src/app/(app)/subscriptions/page.tsx) don't change.
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
  verify(transactionId: string): Promise<boolean>;
}

function comingSoonProvider(id: PaymentProviderId, label: string): PaymentProvider {
  return {
    id,
    label,
    async initiate() {
      return { ok: false, message: `درگاه پرداخت ${label} به‌زودی فعال می‌شود.` };
    },
    async verify() {
      return false;
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
