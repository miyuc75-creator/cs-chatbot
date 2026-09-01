import { getAnthropicClient, HAIKU_MODEL } from "./client";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { ConversationCategory } from "@/types/database";

const CATEGORIES: ConversationCategory[] = [
  "return_exchange",
  "product_question",
  "general_question",
  "complaint",
  "undetermined",
];

export interface InquiryAnalysis {
  category: ConversationCategory;
  subQuestions: string[];
  isActionRequest: boolean;
}

const ANALYZE_TOOL = {
  name: "analyze_inquiry",
  description: "顧客の問い合わせを分類し、含まれる質問を分解する",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string" as const,
        enum: CATEGORIES,
        description: Object.entries(CATEGORY_LABELS)
          .map(([key, label]) => `${key}: ${label}`)
          .join(" / "),
      },
      sub_questions: {
        type: "array" as const,
        items: { type: "string" as const },
        minItems: 1,
        maxItems: 3,
        description:
          "メッセージに含まれる独立した質問を1〜3個の短い質問文に分解したもの。単一の質問なら元の文をそのまま1個返す。",
      },
      is_action_request: {
        type: "boolean" as const,
        description:
          "顧客が返品・交換・返金などの手続きを「今すぐ実行してほしい」と依頼している場合はtrue。" +
          "制度や条件について尋ねているだけ、または不具合の事実を報告しているだけの場合はfalse。",
      },
    },
    required: ["category", "sub_questions", "is_action_request"],
  },
};

const SYSTEM_PROMPT = `あなたはECサイトのカスタマーサポート問い合わせを分析するアシスタントです。
顧客のメッセージを読み、以下の3つを行ってください。

1. 以下のいずれか1つのカテゴリに分類する。
- return_exchange: 返品・交換に関する質問。商品の破損・不良の報告など、事実を伝えた上で返品・交換を求めるものも含む。
- product_question: 商品の使い方・成分・仕様など商品自体についての質問
- general_question: 配送・支払い・ポイントなど、上記以外の一般的なFAQ質問
- complaint: 対応の遅さへの不満、謝罪・責任者対応の要求など、サービスや対応そのものへの強い不満・怒りの表明。
  単に「商品が壊れていた/届かない」等の事実を淡々と報告しているだけの場合はcomplaintではなくreturn_exchangeやgeneral_questionに分類する。
- undetermined: 上記のいずれにも当てはまらない、または判断できない質問

在庫・個別の配送状況などリアルタイム情報が必要な質問はgeneral_questionまたはundeterminedに分類してください。

2. メッセージに複数の質問が含まれる場合、それぞれ検索しやすい短い質問文に分解する(最大3個)。
単一の質問であれば、そのままの文を1個だけ返す。

3. is_action_requestを判定する。
「返品したい」「交換してください」「返金してほしい」のように、返品・交換・返金の手続きを今すぐ進めてほしいという意思表示であればtrue。
「返品はできますか?」「返品の期限は?」のような一般的な質問や、不具合の事実報告だけの場合はfalse。

必ずanalyze_inquiryツールを使って回答してください。`;

// Claude Haikuで顧客の問い合わせをカテゴリ分類し、質問を検索用に分解する。
export async function analyzeInquiry(message: string): Promise<InquiryAnalysis> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    tools: [ANALYZE_TOOL],
    tool_choice: { type: "tool", name: "analyze_inquiry" },
    messages: [{ role: "user", content: message }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { category: "undetermined", subQuestions: [message], isActionRequest: false };
  }

  const input = toolUse.input as {
    category?: string;
    sub_questions?: string[];
    is_action_request?: boolean;
  };
  const category = CATEGORIES.find((c) => c === input.category) ?? "undetermined";
  const subQuestions =
    input.sub_questions && input.sub_questions.length > 0 ? input.sub_questions : [message];
  const isActionRequest = input.is_action_request ?? false;

  return { category, subQuestions, isActionRequest };
}
