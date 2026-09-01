import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildHandoffMessage } from "@/lib/ai/escalate";
import { notifyEscalation } from "@/lib/resend/notify";
import type { ChatSendResponse } from "@/types/chat";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
});

// 「オペレーターに相談」ボタン: AIの判定を待たず、顧客の希望で有人対応へ切り替える。
export async function POST(request: Request) {
  const auth = await createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const parseResult = requestSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  const { conversationId } = parseResult.data;

  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: "問い合わせが見つかりません" }, { status: 404 });
  }

  if (conversation.status === "ai_active") {
    await admin
      .from("conversations")
      .update({ status: "waiting_operator" })
      .eq("id", conversationId);

    await notifyEscalation(conversationId, conversation.category);
  }

  const message = buildHandoffMessage("customer_requested");
  const { data: reply, error } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender: "ai", content: message })
    .select("id, sender, content, created_at")
    .single();

  if (error) {
    throw new Error(`メッセージの保存に失敗しました: ${error.message}`);
  }

  const response: ChatSendResponse = {
    conversationId,
    status: "waiting_operator",
    category: conversation.category,
    reply: {
      id: reply.id,
      sender: reply.sender,
      content: reply.content,
      createdAt: reply.created_at,
    },
  };

  return NextResponse.json(response);
}
