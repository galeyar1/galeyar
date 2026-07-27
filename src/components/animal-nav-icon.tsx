import { Rabbit } from "lucide-react";

/**
 * The Animals/Livestock nav icon — previously a raster PNG brand mark
 * (public/brand/nav-icon-96.png), which couldn't recolor via currentColor
 * like every other lucide icon in the nav and looked inconsistent in Dark
 * Mode (always rendered in its own fixed green). Replaced with a proper
 * vector icon from the project's existing icon library (lucide-react) —
 * same choice already used for "livestock" in the admin panel
 * (galeyar-admin/src/lib/nav.ts), for consistency across both apps.
 *
 * Prop shape unchanged (`className` only) so every existing call site
 * (dashboard, (app)/layout.tsx, register page, navigation-rules.ts) needs
 * no changes — this now behaves exactly like the lucide icons around it,
 * including active/inactive/hover color via currentColor.
 */
export function AnimalNavIcon({ className }: { className?: string }) {
  return <Rabbit className={className} />;
}
