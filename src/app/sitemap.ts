import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Everything past the entry point requires authentication and has no
// public content to index — this only lists the actual public surface.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://galeyar.ir";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/auth/login`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
