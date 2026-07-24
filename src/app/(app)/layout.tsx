"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardPlus,
  History,
  BarChart3,
  Sparkles,
  Settings,
  Home as HomeIcon,
  ArrowRight,
  Briefcase,
  Menu,
} from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { FarmSwitcher } from "@/components/farm-switcher";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { AnimalNavIcon } from "@/components/animal-nav-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BOTTOM_NAVIGATION, HAMBURGER_MENU } from "@/lib/navigation-rules";
import type { UserRole } from "@/lib/supabase/types";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

/**
 * Bottom nav is role-scoped per the spec's separate Manager/Operator/Vet/
 * Consultant navigation. Owner's list is the general-purpose one and is
 * capped at 5 items per src/lib/navigation-rules.ts (the permanent design
 * standard) — everything else owners need lives in the hamburger drawer.
 * The other roles' lists are already well under the 5-item cap and are
 * role-specific subsets outside that rule's scope.
 */
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  owner: BOTTOM_NAVIGATION,
  operator: [
    { href: "/home", label: "خانه", icon: HomeIcon },
    { href: "/register", label: "ثبت", icon: ClipboardPlus },
    { href: "/history", label: "تاریخچه", icon: History },
  ],
  vet: [
    { href: "/animals", label: "دام‌ها", icon: AnimalNavIcon },
    { href: "/register", label: "ثبت درمان", icon: ClipboardPlus },
    { href: "/history", label: "تاریخچه", icon: History },
    { href: "/ai", label: "دستیار", icon: Sparkles },
  ],
  consultant: [
    { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/reports", label: "گزارش", icon: BarChart3 },
    { href: "/ai", label: "دستیار", icon: Sparkles },
    { href: "/business", label: "کسب‌وکار", icon: Briefcase },
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
  "/feed": "خوراک",
  "/reports": "گزارش‌ها و تحلیل",
  "/farms": "مزرعه‌های من",
  "/farms/new": "ساخت مزرعه جدید",
  "/pedigree": "شجره‌نامه",
  "/pedigree/view": "شجره‌نامه",
  "/register/vaccination": "ثبت واکسیناسیون",
  "/register/deworming": "ثبت ضد انگل",
  "/ai/pregnancy": "دستیار آبستنی",
  "/ai/disease": "دستیار بیماری",
  "/ai/vaccination": "دستیار واکسیناسیون",
  "/ai/deworming": "دستیار ضد انگل",
  "/ai/herd-growth": "دستیار رشد گله",
  "/ai/genetics": "دستیار ژنتیک",
  "/register/finance": "ثبت تراکنش مالی",
  "/register/genetic-test": "ثبت آزمایش ژنتیک",
  "/business/finance": "هوش مالی",
  "/business/global-dashboard": "داشبورد کل دامداری‌ها",
  "/business/analytics": "تحلیل کسب‌وکار",
  "/business/performance": "عملکرد دامداری",
  "/business/genetics": "ژنتیک پیشرفته",
  "/business/genetics-intelligence": "هوش ژنتیکی",
  "/business/reports": "گزارشات پیشرفته",
  "/business/notifications": "مرکز اعلان‌ها",
  "/business/support": "مرکز پشتیبانی",
  "/business/education": "مرکز آموزش",
};

/** Breadcrumb trail for nested pages — the back button covers "go one step back", this covers "where am I". */
const BREADCRUMBS: Record<string, { label: string; href: string }[]> = {
  "/animals/new": [{ label: "دام‌ها", href: "/animals" }],
  "/animals/view": [{ label: "دام‌ها", href: "/animals" }],
  "/pedigree": [{ label: "دام‌ها", href: "/animals" }],
  "/pedigree/view": [{ label: "شجره‌نامه", href: "/pedigree" }],
  "/register/milk": [{ label: "ثبت", href: "/register" }],
  "/register/weight": [{ label: "ثبت", href: "/register" }],
  "/register/disease": [{ label: "ثبت", href: "/register" }],
  "/register/birth": [{ label: "ثبت", href: "/register" }],
  "/register/treatment": [{ label: "ثبت", href: "/register" }],
  "/register/vaccination": [{ label: "ثبت", href: "/register" }],
  "/register/deworming": [{ label: "ثبت", href: "/register" }],
  "/farms/new": [{ label: "مزرعه‌های من", href: "/farms" }],
  "/ai/pregnancy": [{ label: "دستیار هوشمند", href: "/ai" }],
  "/ai/disease": [{ label: "دستیار هوشمند", href: "/ai" }],
  "/ai/vaccination": [{ label: "دستیار هوشمند", href: "/ai" }],
  "/ai/deworming": [{ label: "دستیار هوشمند", href: "/ai" }],
  "/ai/herd-growth": [{ label: "دستیار هوشمند", href: "/ai" }],
  "/ai/genetics": [{ label: "دستیار هوشمند", href: "/ai" }],
  "/register/finance": [{ label: "ثبت", href: "/register" }],
  "/register/genetic-test": [{ label: "ثبت", href: "/register" }],
  "/business/finance": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/global-dashboard": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/analytics": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/performance": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/genetics": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/genetics-intelligence": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/reports": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/notifications": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/support": [{ label: "کسب‌وکار", href: "/business" }],
  "/business/education": [{ label: "کسب‌وکار", href: "/business" }],
};

/** Routes that show the brand mark + settings gear instead of a back button — the roots of each bottom-nav tab. */
const TOP_LEVEL_PATHS = new Set([
  "/dashboard",
  "/animals",
  "/register",
  "/history",
  "/home",
  "/ai",
  "/business",
  "/settings",
]);

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
  "/farms": "/dashboard",
  "/farms/new": "/farms",
  "/pedigree": "/animals",
  "/pedigree/view": "/pedigree",
  "/register/vaccination": "/register",
  "/register/deworming": "/register",
  "/ai/pregnancy": "/ai",
  "/ai/disease": "/ai",
  "/ai/vaccination": "/ai",
  "/ai/deworming": "/ai",
  "/ai/herd-growth": "/ai",
  "/ai/genetics": "/ai",
  "/register/finance": "/register",
  "/register/genetic-test": "/register",
  "/business/finance": "/business",
  "/business/global-dashboard": "/business",
  "/business/analytics": "/business",
  "/business/performance": "/business",
  "/business/genetics": "/business",
  "/business/genetics-intelligence": "/business",
  "/business/reports": "/business",
  "/business/notifications": "/business",
  "/business/support": "/business",
  "/business/education": "/business",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label="باز کردن منو"
          >
            <Menu className="size-5" />
          </Button>

          {isTopLevel ? (
            <span className="flex items-center justify-center gap-2 overflow-hidden">
              <Logo size={28} />
              <span className="text-lg font-bold text-primary">گله‌یار</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 overflow-hidden">
              <Button variant="ghost" size="icon" onClick={goBack} aria-label="بازگشت" className="shrink-0">
                <ArrowRight className="size-5" />
              </Button>
              <span className="truncate text-base font-bold">{title ?? "گله‌یار"}</span>
            </span>
          )}

          <span className="flex items-center justify-end gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settings">
                <Settings className="size-5" />
              </Link>
            </Button>
          </span>
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

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="flex flex-col p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Logo size={24} />
              گله‌یار
            </SheetTitle>
          </SheetHeader>
          <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {HAMBURGER_MENU.map((item) => {
              const Icon = item.icon;
              if (item.comingSoon) {
                return (
                  <li key={item.href}>
                    <div className="flex cursor-not-allowed items-center gap-3 rounded-xl p-3.5 text-muted-foreground opacity-60">
                      <Icon className="size-6 shrink-0" />
                      <span className="flex-1 text-base font-medium">{item.label}</span>
                      <Badge variant="secondary">به‌زودی</Badge>
                    </div>
                  </li>
                );
              }
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl p-3.5 text-base font-medium transition-colors active:bg-muted",
                      active ? "bg-primary/10 text-primary" : "text-foreground"
                    )}
                  >
                    <Icon className="size-6 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
