import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OperatorRow } from "@/types/database";

// 管理画面の各ページで呼び出す。ログイン済みかつoperatorsテーブルに
// レコードがある(=正式なオペレーター)ことを確認し、そうでなければログイン画面へ戻す。
export async function requireOperator(): Promise<OperatorRow> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: operator } = await supabase
    .from("operators")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!operator) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_operator");
  }

  return operator;
}
