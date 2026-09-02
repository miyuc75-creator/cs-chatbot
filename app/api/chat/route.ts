import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchKnowledgeItemsForQuestions } from "@/lib/rag/search";
import { analyzeInquiry } from "@/lib/ai/classify";
import { generateAnswer } from "@/lib/ai/respond";
import { decideEscalation, buildHandoffMessage } from "@/lib/ai/escalate";
import { notifyEscalation } from "@/lib/resend/notify";
import type { ChatMessage, ChatSendRequest, ChatSendResponse, EscalationDecision } from "@/types/chat";
import type { ConversationCategory, ConversationRow, MatchKnowledgeItemResult } from "@/types/database";

const requestSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  message: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const auth = await createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const parseResult = requestSchema.safeParse(
    (await request.json()) as ChatSendRequest
  );
  if (!parseResult.success) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  const { conversationId, message } = parseResult.data;

  const admin = createAdminClient();

  const conversation = await resolveConversation(admin, user.id, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "問い合わせが見つかりません" }, { status: 404 });
  }

  await insertMessage(admin, conversation.id, "customer", message);

  // すでに有人対応へ引き継ぎ済みの場合、AIは処理せず受付のみ行う。
  if (conversation.status !== "ai_active") {
    const reply = await insertMessage(
      admin,
      conversation.id,
      "ai",
      "メッセージを受け付けました。オペレーターが確認次第ご案内します。"
    );
    return NextResponse.json(
      buildResponse(conversation.id, conversation.status, conversation.category, reply)
    );
  }

  const history = await fetchHistory(admin, conversation.id);

  let category: ConversationCategory;
  let subQuestions: string[];
  let isActionRequest: boolean;
  try {
    ({ category, subQuestions, isActionRequest } = await analyzeInquiry(message));
  } catch (error) {
    // Anthropic APIの障害・過負荷時でも顧客への応答自体は継続させ、有人対応へフォールバックする。
    console.error("問い合わせ分類に失敗したため、有人対応にフォールバックします:", error);
    return escalateConversation(admin, conversation.id, null, "ai_unavailable");
  }

  // クレーム・判断不能・返品実行依頼はFAQの一致に関わらず有人対応になるため、
  // Embedding APIの呼び出し(レート制限が厳しい)を節約するためFAQ検索自体を行わない。
  const skipsFaqSearch =
    category === "complaint" ||
    category === "undetermined" ||
    (category === "return_exchange" && isActionRequest);
  let faqMatches: MatchKnowledgeItemResult[] = [];
  let decision: EscalationDecision;
  if (skipsFaqSearch) {
    decision = decideEscalation(category, faqMatches, isActionRequest);
  } else {
    try {
      faqMatches = await searchKnowledgeItemsForQuestions(subQuestions);
      decision = decideEscalation(category, faqMatches, isActionRequest);
    } catch (error) {
      // Voyage AIの障害・レート制限時でも顧客への応答自体は継続させ、有人対応へフォールバックする。
      console.error("FAQ検索に失敗したため、有人対応にフォールバックします:", error);
      decision = { shouldEscalate: true, reason: "search_unavailable" };
    }
  }

  if (decision.shouldEscalate && decision.reason) {
    return escalateConversation(admin, conversation.id, category, decision.reason);
  }

  await admin.from("conversations").update({ category }).eq("id", conversation.id);

  let answer: string;
  try {
    answer = await generateAnswer(message, faqMatches, history);
  } catch (error) {
    // Anthropic APIの障害・過負荷時でも顧客への応答自体は継続させ、有人対応へフォールバックする。
    console.error("回答生成に失敗したため、有人対応にフォールバックします:", error);
    return escalateConversation(admin, conversation.id, category, "ai_unavailable");
  }
  const reply = await insertMessage(admin, conversation.id, "ai", answer);

  return NextResponse.json(buildResponse(conversation.id, "ai_active", category, reply));
}

async function escalateConversation(
  admin: AdminClient,
  conversationId: string,
  category: ConversationCategory | null,
  reason: NonNullable<EscalationDecision["reason"]>
): Promise<NextResponse> {
  await admin
    .from("conversations")
    .update({ status: "waiting_operator", category })
    .eq("id", conversationId);

  const reply = await insertMessage(admin, conversationId, "ai", buildHandoffMessage(reason));

  await notifyEscalation(conversationId, category);

  return NextResponse.json(buildResponse(conversationId, "waiting_operator", category, reply));
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function resolveConversation(
  admin: AdminClient,
  customerId: string,
  conversationId: string | null
): Promise<ConversationRow | null> {
  if (conversationId) {
    const { data } = await admin
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("customer_id", customerId)
      .maybeSingle();
    return data;
  }

  const { data, error } = await admin
    .from("conversations")
    .insert({ customer_id: customerId })
    .select("*")
    .single();

  if (error) {
    throw new Error(`問い合わせの作成に失敗しました: ${error.message}`);
  }
  return data;
}

async function insertMessage(
  admin: AdminClient,
  conversationId: string,
  sender: ChatMessage["sender"],
  content: string
): Promise<ChatMessage> {
  const { data, error } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender, content })
    .select("id, sender, content, created_at")
    .single();

  if (error) {
    throw new Error(`メッセージの保存に失敗しました: ${error.message}`);
  }

  return { id: data.id, sender: data.sender, content: data.content, createdAt: data.created_at };
}

async function fetchHistory(admin: AdminClient, conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await admin
    .from("messages")
    .select("id, sender, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    throw new Error(`会話履歴の取得に失敗しました: ${error.message}`);
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender,
    content: m.content,
    createdAt: m.created_at,
  }));
}

function buildResponse(
  conversationId: string,
  status: ConversationRow["status"],
  category: ConversationRow["category"],
  reply: ChatMessage
): ChatSendResponse {
  return { conversationId, status, category, reply };
}
