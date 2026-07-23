import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Deno edge functions: different runtime/globals, checked separately
    // (`supabase functions deploy` type-checks them at deploy time).
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/functions/**"],
  },
];

export default eslintConfig;
