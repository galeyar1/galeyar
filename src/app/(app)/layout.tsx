"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PawPrint,
  ClipboardPlus,
  History,
  BarChart3,
  Sparkles,
  Settings,
  Home as HomeIcon,
} from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/supabase/types";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

/** Bottom nav is role-scoped per the spec's separate Manager/Operator/Vet/Consultant navigation. */
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  owner: [
    { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/animals", label: "دام‌ها", icon: PawPrint },
    { href: "/register", label: "ثبت", icon: ClipboardPlus },
    { href: "/reports", label: "گزارش", icon: BarChart3 },
    { href: "/ai", label: "دستیار", icon: Sparkles },
  ],
  operator: [
    { href: "/home", label: "خانه", icon: HomeIcon },
    { href: "/register", label: "ثبت", icon: ClipboardPlus },
    { href: "/history", label: "تاریخچه", icon: History },
  ],
  vet: [
    { href: "/animals", label: "دام‌ها", icon: PawPrint },
    { href: "/register", label: "ثبت درمان", icon: ClipboardPlus },
    { href: "/history", label: "تاریخچه", icon: History },
  ],
  consultant: [
    { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/reports", label: "گزارش", icon: BarChart3 },
    { href: "/ai", label: "دستیار", icon: Sparkles },
  ],
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, loading } = useAuth();

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

  const navItems = NAV_BY_ROLE[profile.role];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-lg font-bold text-primary">گله‌یار</span>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <Settings className="size-5" />
          </Link>
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
