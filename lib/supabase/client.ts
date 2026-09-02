import { createBrowserClient } from "@supabase/ssr";
import { getCookieOptions } from "./cookie-options";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: getCookieOptions() }
  );
}
