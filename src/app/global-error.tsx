"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import "./globals.css";

/**
 * Catches errors in the ROOT layout itself (AuthProvider/ThemeProvider are
 * gone at this point, replaced entirely by this file per Next.js
 * convention) — so no user/farm context is available, unlike (app)/error.tsx.
 * Extremely rare in practice; this exists so that case isn't a blank page.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void supabase.from("client_error_logs").insert({
      message: `[root] ${error.message}`,
      stack: error.stack ?? null,
      url: typeof window !== "undefined" ? window.location.pathname : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen items-center justify-center p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-base font-semibold">مشکلی پیش آمد</p>
          <p className="text-sm text-muted-foreground">
            یک خطای غیرمنتظره رخ داد. این مشکل ثبت شد — لطفاً صفحه را دوباره بارگذاری کنید.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
