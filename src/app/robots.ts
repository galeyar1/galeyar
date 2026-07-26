import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// app.galeyar.ir is the private, authenticated livestock-management app —
// every route requires a session and has nothing worth indexing. The
// future public marketing site at galeyar.ir will carry its own real
// robots.txt/sitemap; this one just keeps this domain out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
