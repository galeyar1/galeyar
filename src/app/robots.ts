import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Every route past the entry point immediately redirects an unauthenticated
// crawler to /auth/login anyway, so there's nothing sensitive to hide —
// this just points crawlers at the sitemap rather than disallowing anything.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://galeyar.ir/sitemap.xml",
  };
}
