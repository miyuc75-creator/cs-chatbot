import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service Role Keyを使うクライアント。RLSを全てバイパスするため、
// RAGパイプライン(FAQ検索・AI回答保存)やエスカレーション処理など、
// サーバー側のAPI Route内でのみ生成・使用すること。ブラウザ向けに絶対に公開しない。
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
