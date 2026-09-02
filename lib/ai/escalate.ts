import { getBusinessHours, isWithinBusinessHours } from "./business-hours";
import type { ConversationCategory, MatchKnowledgeItemResult } from "@/types/database";
import type { EscalationDecision } from "@/types/chat";

// この類似度を下回るFAQしか見つからない場合は「回答に自信がない」とみなす。
// 元は0.6だったが、FAQの言い換え質問26件(18 FAQ言い換え+8件のFAQ外質問)での
// 実測比較で0.5に変更した:
//   0.6: recall 12/18(66.7%) / precision 8/8(100%)
//   0.5: recall 16/18(88.9%) / precision 7/8がクリーンにエスカレーション+1件は
//        「AIが正直に回答を断ったがステータスはai_activeのまま」という
//        ハルシネーションではないが運用上の抜け穴のケースが発生
// recallの改善幅がprecision側の劣化(捏造ではない)を上回ると判断し0.5を採用。
// 将来的にはAIの回答文に「オペレーターにご確認ください」等の断り文言が
// 含まれる場合に強制エスカレーションする仕組みを追加すると、この抜け穴を
// 完全に塞げる(未実装)。
const LOW_CONFIDENCE_THRESHOLD = 0.5;

// AIのみで判断できる問い合わせかどうかを決定する。
// 定義書「9. 有人対応条件」: クレーム / 回答不能 / FAQに情報がない / 判断不能 / 信頼度が低い。
export function decideEscalation(
  category: ConversationCategory,
  faqMatches: MatchKnowledgeItemResult[],
  isActionRequest: boolean = false
): EscalationDecision {
  if (category === "complaint") {
    return { shouldEscalate: true, reason: "complaint" };
  }

  if (category === "undetermined") {
    return { shouldEscalate: true, reason: "undetermined_category" };
  }

  // 「返品したい」等、返品・交換を今すぐ実行してほしいという依頼はAIだけで最終承認しない
  // (定義書「8. AI回答ルール」)。制度についての質問(例:届いた商品が壊れていた)はFAQで直接回答する。
  if (category === "return_exchange" && isActionRequest) {
    return { shouldEscalate: true, reason: "return_action" };
  }

  if (faqMatches.length === 0) {
    return { shouldEscalate: true, reason: "no_faq_match" };
  }

  if (faqMatches[0].similarity < LOW_CONFIDENCE_THRESHOLD) {
    return { shouldEscalate: true, reason: "low_confidence" };
  }

  return { shouldEscalate: false, reason: null };
}

const HANDOFF_MESSAGES: Record<NonNullable<EscalationDecision["reason"]>, string> = {
  complaint:
    "ご不便をおかけし申し訳ございません。担当のオペレーターにお繋ぎいたしますので、少々お待ちください。",
  customer_requested: "かしこまりました。オペレーターにお繋ぎいたします。少々お待ちください。",
  undetermined_category:
    "恐れ入りますが、こちらでは正確にお答えしかねる内容のため、オペレーターに確認いたします。少々お待ちください。",
  no_faq_match:
    "恐れ入りますが、こちらでは正確にお答えしかねる内容のため、オペレーターに確認いたします。少々お待ちください。",
  low_confidence:
    "恐れ入りますが、こちらでは正確にお答えしかねる内容のため、オペレーターに確認いたします。少々お待ちください。",
  return_action:
    "返品・交換のお手続きは、内容を確認の上オペレーターより改めてご案内いたします。少々お待ちください。",
  search_unavailable:
    "恐れ入りますが、こちらでは正確にお答えしかねる内容のため、オペレーターに確認いたします。少々お待ちください。",
  ai_unavailable:
    "只今AIによる自動応答が混み合っております。恐れ入りますが、オペレーターより改めてご案内いたします。少々お待ちください。",
};

// 有人対応への引き継ぎ時に顧客へ表示する定型メッセージを生成する。
// 営業時間外の場合は、翌営業日対応になる旨を追記する(定義書「2. 有人対応・営業時間」)。
// 営業時間は管理画面(app_settings)で設定可能なため、案内文言もその設定値に合わせて生成する。
export async function buildHandoffMessage(
  reason: NonNullable<EscalationDecision["reason"]>
): Promise<string> {
  const base = HANDOFF_MESSAGES[reason];
  if (await isWithinBusinessHours()) {
    return base;
  }

  const { start, end } = await getBusinessHours();
  const suffix = `\n\nただいま営業時間外(${start}:00〜${end}:00)のため、翌営業日にオペレーターが対応いたします。`;
  return `${base}${suffix}`;
}
