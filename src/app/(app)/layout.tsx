"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, PawPrint, LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/auth/login");
      return;
    }
    if (!profile?.farm_id) {
      router.replace("/onboarding/farm");
    }
  }, [loading, session, profile, router]);

  if (loading || !session || !profile?.farm_id) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <p className="text-muted-foreground">در حال بارگذاری…</p>
      </div>
    );
  }

  const canSeeDashboard = profile.role === "owner" || profile.role === "consultant";

  const navItems = [
    canSeeDashboard && { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/animals", label: "دام‌ها", icon: PawPrint },
  ].filter(Boolean) as { href: string; label: string; icon: typeof LayoutDashboard }[];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-lg font-bold text-primary">گله‌یار</span>
        <Button variant="ghost" size="icon" onClick={() => signOut().then(() => router.push("/auth/login"))}>
          <LogOut className="size-5" />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-card">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-6" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
