import { generateSW } from "workbox-build";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "out");

const { count, size, warnings } = await generateSW({
  swDest: path.join(outDir, "sw.js"),
  globDirectory: outDir,
  globPatterns: [
    "**/*.{js,css,html,png,svg,ico,woff2,webmanifest,json}",
  ],
  globIgnores: ["sw.js", "workbox-*.js"],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: "/",
  navigateFallbackDenylist: [/^\/_/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "galeyar-storage-images",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/,
      handler: "NetworkOnly",
    },
  ],
});

if (warnings.length > 0) {
  console.warn("Workbox warnings:", warnings);
}

console.log(`Service worker generated: ${count} files precached, ${(size / 1024).toFixed(1)} KB`);
