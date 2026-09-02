import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { ConversationCategory } from "@/types/database";

// 有人対応が必要になったことをオペレーターへメール通知する(定義書「12. 通知」)。
// 送信先メールアドレスは管理画面(app_settings)で設定可能。
// RESEND_API_KEY未設定、または送信先メールアドレスが取得できない場合は通知をスキップする
// (チャット応答自体は通知の成否に関わらず継続させる)。
export async function notifyEscalation(
  conversationId: string,
  category: ConversationCategory | null
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY未設定のため、エスカレーション通知をスキップしました。");
    return;
  }

  const to = await getEscalationEmails();
  if (!to || to.length === 0) {
    console.warn("通知先メールアドレスを取得できなかったため、エスカレーション通知をスキップしました。");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const categoryLabel = category ? CATEGORY_LABELS[category] : "未分類";
  const occurredAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const adminUrl = `${appUrl}/admin/${conversationId}`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "CSチャットボット <onboarding@resend.dev>",
      to,
      subject: "新しい有人対応が必要です",
      text: [
        "新しい有人対応が必要です",
        "",
        `カテゴリ: ${categoryLabel}`,
        `発生日時: ${occurredAt}`,
        `管理画面: ${adminUrl}`,
      ].join("\n"),
    });
  } catch (error) {
    // 通知の失敗はチャット応答自体をブロックしない。
    console.error("エスカレーション通知メールの送信に失敗しました:", error);
  }
}

async function getEscalationEmails(): Promise<string[] | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("escalation_emails")
    .eq("id", 1)
    .single();

  if (error || !data) {
    console.error("通知先メールアドレスの取得に失敗しました:", error);
    return null;
  }

  return data.escalation_emails;
}
