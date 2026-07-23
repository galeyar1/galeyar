"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

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
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-background text-center">
      <h1 className="text-3xl font-bold text-primary">گله‌یار</h1>
      <p className="text-muted-foreground">در حال بارگذاری…</p>
    </div>
  );
}
