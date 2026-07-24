import {
  LayoutDashboard,
  ClipboardPlus,
  Sparkles,
  Settings,
  GitBranch,
  Wheat,
  BarChart3,
  Briefcase,
  LifeBuoy,
  GraduationCap,
  Building2,
  Syringe,
  Bug,
  Store,
  CreditCard,
} from "lucide-react";
import { AnimalNavIcon } from "@/components/animal-nav-icon";

/**
 * GALEYAR navigation placement rule (permanent design standard, v1.7+).
 * Before adding any new module, ask:
 *
 * 1. Is this a core, daily feature nearly every user opens every session?
 *    -> put it in BOTTOM_NAVIGATION.
 * 2. Is it an advanced or occasional feature (checked weekly/monthly, or
 *    used by a subset of roles)?
 *    -> put it in HAMBURGER_MENU.
 *
 * Bottom navigation must NEVER exceed MAX_BOTTOM_NAV_ITEMS entries — that
 * cap is what one-handed mobile use depends on. This file is the single
 * source of truth for both menus; src/app/(app)/layout.tsx only renders it.
 */

export const MAX_BOTTOM_NAV_ITEMS = 5;

export interface NavRuleItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Module named in the spec but with no route yet — rendered disabled with a "به‌زودی" badge. */
  comingSoon?: boolean;
}

export const BOTTOM_NAVIGATION: NavRuleItem[] = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/animals", label: "دام‌ها", icon: AnimalNavIcon },
  { href: "/register", label: "ثبت", icon: ClipboardPlus },
  { href: "/ai", label: "دستیار هوشمند", icon: Sparkles },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

export const HAMBURGER_MENU: NavRuleItem[] = [
  { href: "/pedigree", label: "شجره‌نامه", icon: GitBranch },
  { href: "/feed", label: "خوراک و جیره", icon: Wheat },
  { href: "/reports", label: "گزارشات", icon: BarChart3 },
  { href: "/business", label: "کسب‌وکار", icon: Briefcase },
  { href: "/business/support", label: "پشتیبانی", icon: LifeBuoy },
  { href: "/business/education", label: "مرکز آموزش", icon: GraduationCap },
  { href: "/farms", label: "چند دامداری", icon: Building2 },
  { href: "/register/vaccination", label: "واکسیناسیون", icon: Syringe },
  { href: "/register/deworming", label: "ضد انگل", icon: Bug },
  { href: "/marketplace", label: "بازار گله‌یار", icon: Store, comingSoon: true },
  { href: "/subscriptions", label: "اشتراک‌ها", icon: CreditCard, comingSoon: true },
];
