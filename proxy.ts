import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getCookieOptions } from "@/lib/supabase/cookie-options";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";

// 顧客の匿名セッション / オペレーターのセッションのCookieを各リクエストで検証・更新する。
// Server Component自体はCookieを書き込めないため、トークンのリフレッシュはここで行う必要がある
// (Next.js 16ではmiddleware.tsはproxy.tsへ改名されたが、役割・APIはSupabaseのmiddlewareパターンと同じ)。
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
      cookieOptions: getCookieOptions(),
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
