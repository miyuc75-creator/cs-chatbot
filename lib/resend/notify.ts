import "server-only";
import { Resend } from "resend";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { ConversationCategory } from "@/types/database";

// 有人対応が必要になったことをオペレーターへメール通知する(定義書「12. 通知」)。
// RESEND_API_KEY / ESCALATION_EMAIL_TOが未設定の場合は通知をスキップする
// (チャット応答自体は通知の成否に関わらず継続させる)。
export async function notifyEscalation(
  conversationId: string,
  category: ConversationCategory | null
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ESCALATION_EMAIL_TO;

  if (!apiKey || !to) {
    console.warn("RESEND_API_KEYまたはESCALATION_EMAIL_TO未設定のため、エスカレーション通知をスキップしました。");
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
