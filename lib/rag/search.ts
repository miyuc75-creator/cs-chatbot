import { createAdminClient } from "@/lib/supabase/admin";
import { embedQueries } from "@/lib/rag/embed";
import type { MatchKnowledgeItemResult } from "@/types/database";

const DEFAULT_MATCH_COUNT = 3;
const PER_QUESTION_MATCH_COUNT = 2;
const MAX_MERGED_MATCHES = 5;

// ユーザーの質問embeddingでFAQ(knowledge_items)をベクトル検索する。
// knowledge_itemsはRLSで匿名/認証済みユーザーからのアクセスを拒否しているため、
// 検索は必ずservice roleクライアント経由で行う。
export async function searchKnowledgeItems(
  queryEmbedding: number[],
  matchCount: number = DEFAULT_MATCH_COUNT
): Promise<MatchKnowledgeItemResult[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("match_knowledge_items", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`FAQ検索に失敗しました: ${error.message}`);
  }

  return data ?? [];
}

// 1メッセージに複数の質問が含まれる場合に対応するため、質問ごとに検索して結果をマージする。
// Embeddingは1回のAPIリクエストにまとめて生成する(Voyage AIのレート制限対策)。
export async function searchKnowledgeItemsForQuestions(
  subQuestions: string[]
): Promise<MatchKnowledgeItemResult[]> {
  const embeddings = await embedQueries(subQuestions);

  const resultsPerQuestion = await Promise.all(
    embeddings.map((embedding) => searchKnowledgeItems(embedding, PER_QUESTION_MATCH_COUNT))
  );

  const merged = new Map<string, MatchKnowledgeItemResult>();
  for (const results of resultsPerQuestion) {
    for (const item of results) {
      const existing = merged.get(item.id);
      if (!existing || item.similarity > existing.similarity) {
        merged.set(item.id, item);
      }
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_MERGED_MATCHES);
}
