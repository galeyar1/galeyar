"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Next.js error boundary for every route under (app) — catches render
 * errors in a mounted subtree only, not every possible failure mode (a
 * rejected promise outside React's render cycle won't reach this). Best-
 * effort logging to client_error_logs (migration 0024): never blocks or
 * throws itself, since a broken error reporter would be worse than none.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { session, profile } = useAuth();

  useEffect(() => {
    void supabase
      .from("client_error_logs")
      .insert({
        farm_id: profile?.farm_id ?? null,
        user_id: session?.user.id ?? null,
        message: error.message,
        stack: error.stack ?? null,
        url: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      .then(({ error: insertError }) => {
        if (insertError) console.error("[error-boundary] failed to log error", insertError);
      });
    // Only ever log the error that triggered this mount, not on every
    // session/profile refresh while the fallback stays on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="max-w-sm border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="text-base font-semibold">مشکلی پیش آمد</p>
          <p className="text-sm text-muted-foreground">
            یک خطای غیرمنتظره رخ داد. این مشکل ثبت شد — می‌توانید دوباره تلاش کنید.
          </p>
          <Button onClick={reset}>تلاش دوباره</Button>
        </CardContent>
      </Card>
    </div>
  );
}
