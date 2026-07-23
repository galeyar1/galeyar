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
  Wheat,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { FarmSwitcher } from "@/components/farm-switcher";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import type { UserRole } from "@/lib/supabase/types";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

/** Bottom nav is role-scoped per the spec's separate Manager/Operator/Vet/Consultant navigation. */
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  owner: [
    { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/animals", label: "دام‌ها", icon: PawPrint },
    { href: "/register", label: "ثبت", icon: ClipboardPlus },
    { href: "/feed", label: "خوراک", icon: Wheat },
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

/** Every route reachable in the app, so a sub-page's top bar can show a real title instead of the brand mark. */
const PAGE_TITLES: Record<string, string> = {
  "/animals/new": "ثبت / ویرایش دام",
  "/animals/view": "مشخصات دام",
  "/register/milk": "ثبت شیر",
  "/register/weight": "ثبت وزن",
  "/register/disease": "ثبت بیماری",
  "/register/birth": "ثبت زایمان",
  "/register/treatment": "ثبت درمان",
  "/settings": "تنظیمات",
  "/feed": "مدیریت خوراک",
  "/reports": "گزارش‌ها و تحلیل",
  "/ai": "دستیار هوشمند",
  "/farms": "مزرعه‌های من",
  "/farms/new": "ساخت مزرعه جدید",
  "/animals/pedigree": "شجره‌نامه",
  "/register/vaccination": "ثبت واکسیناسیون",
};

/** Breadcrumb trail for nested pages — the back button covers "go one step back", this covers "where am I". */
const BREADCRUMBS: Record<string, { label: string; href: string }[]> = {
  "/animals/new": [{ label: "دام‌ها", href: "/animals" }],
  "/animals/view": [{ label: "دام‌ها", href: "/animals" }],
  "/animals/pedigree": [{ label: "دام‌ها", href: "/animals" }],
  "/register/milk": [{ label: "ثبت", href: "/register" }],
  "/register/weight": [{ label: "ثبت", href: "/register" }],
  "/register/disease": [{ label: "ثبت", href: "/register" }],
  "/register/birth": [{ label: "ثبت", href: "/register" }],
  "/register/treatment": [{ label: "ثبت", href: "/register" }],
  "/register/vaccination": [{ label: "ثبت", href: "/register" }],
  "/farms/new": [{ label: "مزرعه‌های من", href: "/farms" }],
};

/** Routes that show the brand mark + settings gear instead of a back button — the roots of each bottom-nav tab. */
const TOP_LEVEL_PATHS = new Set(["/dashboard", "/animals", "/register", "/history", "/home"]);

/**
 * Fallback destination when there's no browser history to go back to — e.g.
 * a PWA launched straight into a deep link, or a page opened in a new tab.
 * router.back() is silently a no-op in that case, so we detect an empty
 * history stack and push here instead.
 */
const BACK_FALLBACK: Record<string, string> = {
  "/animals/new": "/animals",
  "/animals/view": "/animals",
  "/register/milk": "/register",
  "/register/weight": "/register",
  "/register/disease": "/register",
  "/register/birth": "/register",
  "/register/treatment": "/register",
  "/settings": "/dashboard",
  "/feed": "/dashboard",
  "/reports": "/dashboard",
  "/ai": "/dashboard",
  "/farms": "/dashboard",
  "/farms/new": "/farms",
  "/animals/pedigree": "/animals",
  "/register/vaccination": "/register",
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background">
        <Logo size={56} />
        <p className="text-muted-foreground">در حال بارگذاری…</p>
      </div>
    );
  }

  const navItems = NAV_BY_ROLE[profile.role];
  const isTopLevel = TOP_LEVEL_PATHS.has(pathname);
  const title = PAGE_TITLES[pathname];
  const breadcrumbs = BREADCRUMBS[pathname];

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(BACK_FALLBACK[pathname] ?? "/dashboard");
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="flex flex-col gap-1 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          {isTopLevel ? (
            <span className="flex items-center gap-2">
              <Logo size={28} />
              <span className="text-lg font-bold text-primary">گله‌یار</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goBack} aria-label="بازگشت">
                <ArrowRight className="size-5" />
              </Button>
              <span className="text-base font-bold">{title ?? "گله‌یار"}</span>
            </span>
          )}
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <Settings className="size-5" />
            </Link>
          </Button>
        </div>

        {breadcrumbs && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb) => (
              <span key={crumb.href} className="flex items-center gap-1">
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
                <span>/</span>
              </span>
            ))}
            <span>{title}</span>
          </nav>
        )}

        <div className="flex items-center justify-between">
          <FarmSwitcher />
          <SyncStatusBadge />
        </div>
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
