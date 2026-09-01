import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(4000),
});

// オペレーターからの返信。RLS("operators insert messages" / "operators update all conversations")が
// 権限チェックを担うため、ここではservice roleを使わずCookieベースのクライアントで操作する。
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const parseResult = requestSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  const { conversationId, content } = parseResult.data;

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender: "operator", content })
    .select("id, sender, content, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 403 });
  }

  // 返信をもって対応中(operator_active)に遷移させる(完了済みの会話への返信は再オープンしない)。
  await supabase
    .from("conversations")
    .update({ status: "operator_active" })
    .eq("id", conversationId)
    .neq("status", "completed");

  return NextResponse.json({ message });
}
