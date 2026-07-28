/**
 * The Animals/Livestock nav icon — previously a raster PNG brand mark
 * (public/brand/nav-icon-96.png), which couldn't recolor via currentColor
 * like every other lucide icon in the nav and looked inconsistent in Dark
 * Mode (always rendered in its own fixed green), then briefly a lucide
 * Rabbit icon. lucide-react has no sheep/ram icon, so this is a small
 * custom SVG (a ram's head with curled horns) drawn in the exact same
 * visual language as the surrounding lucide icons — 24x24 viewBox,
 * currentColor stroke, round caps/joins — so it recolors and sizes
 * identically via className.
 *
 * Prop shape unchanged (`className` only) so every existing call site
 * (dashboard, (app)/layout.tsx, register page, navigation-rules.ts) needs
 * no changes.
 */
export function AnimalNavIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="15" r="4.5" />
      <path d="M8.5 12c-2-1-3-3.5-1.5-5.5 1-1.3 2.8-1 2.8.8 0 1.2-1 1.7-2 1.2" />
      <path d="M15.5 12c2-1 3-3.5 1.5-5.5-1-1.3-2.8-1-2.8.8 0 1.2 1 1.7 2 1.2" />
      <path d="M7.5 14.5c-1-.3-2-.1-2.5.8" />
      <path d="M16.5 14.5c1-.3 2-.1 2.5.8" />
    </svg>
  );
}
