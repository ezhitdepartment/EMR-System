import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at startup instead of silently breaking every feature that
  // reads/writes through Supabase — much easier to debug than a vague
  // "fetch failed" deep in some component.
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase " +
      "project's Settings > API page, then restart the dev server."
  );
}

// Single shared client — import this everywhere instead of calling
// createClient() again, so auth state and connections aren't duplicated.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);