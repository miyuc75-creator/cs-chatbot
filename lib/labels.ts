import type { ConversationCategory, ConversationStatus } from "@/types/database";

export const CATEGORY_LABELS: Record<ConversationCategory, string> = {
  return_exchange: "返品・交換",
  product_question: "商品質問",
  general_question: "一般質問",
  complaint: "クレーム",
  undetermined: "判断不能",
};

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  ai_active: "AI対応中",
  waiting_operator: "対応待ち",
  operator_active: "有人対応中",
  completed: "完了",
};
