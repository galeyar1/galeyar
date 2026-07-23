import Image from "next/image";

/**
 * The Galeyar animal mark (horse/ram/cattle) — replaces the generic PawPrint
 * icon everywhere in navigation. It's a raster illustration (not a single-
 * color SVG), so unlike the lucide icons around it, it can't recolor via
 * currentColor for the active/inactive nav state — it always renders in its
 * own green. Active vs. inactive is instead conveyed by the label text
 * color (already the existing pattern).
 *
 * Prop shape matches lucide's icon components (`className` only) so it can
 * drop into the same `<Icon className="size-6" />` call sites without a
 * special case — the className's Tailwind size utility overrides the
 * intrinsic width/height for actual rendering.
 */
export function AnimalNavIcon({ className }: { className?: string }) {
  return <Image src="/brand/nav-icon-96.png" alt="" width={28} height={28} className={className} unoptimized />;
}
