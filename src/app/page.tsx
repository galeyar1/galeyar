"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { Logo } from "@/components/logo";

export default function Home() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/auth/login");
    } else if (!profile?.farm_id) {
      router.replace("/onboarding/farm");
    } else {
      router.replace("/dashboard");
    }
  }, [loading, session, profile, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background text-center">
      <Logo size={72} />
      <p className="text-muted-foreground">در حال بارگذاری…</p>
    </div>
  );
}
