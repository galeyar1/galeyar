import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* values are inlined into the static bundle at *build* time
// (this is a static export — there is no server to read env vars at
// request time). Cloudflare Pages must have the real values set in the
// project's environment variables before running `npm run build`. The
// placeholders below only exist so a build without them still succeeds
// (e.g. CI type-checking) instead of crashing prerendering.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.local.example"
  );
}

/**
 * Single browser Supabase client for the whole app. Galeyar is a static
 * export (no Next.js server), so this is the only path to the backend —
 * every read/write goes through supabase-js directly and is protected by
 * Postgres RLS, not by a server-side API layer.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
