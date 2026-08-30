import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Server Component / Route Handler内でセッション(Cookie)を伴ってSupabaseへアクセスするためのクライアント。
// RLSが適用されるため、操作可能な範囲はログイン中のユーザー(顧客の匿名セッション or オペレーターのセッション)に限られる。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Componentから呼ばれた場合はCookie書き込みができないため無視する。
            // セッション更新はミドルウェア/Route Handler側で行われる想定。
          }
        },
      },
    }
  );
}
