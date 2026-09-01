const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-lite";
const EMBEDDING_DIMENSION = 512; // knowledge_items.embedding は vector(512) 固定

type VoyageInputType = "query" | "document";

interface VoyageEmbeddingsResponse {
  data: { embedding: number[]; index: number }[];
}

async function embed(input: string[], inputType: VoyageInputType): Promise<number[][]> {
  const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSION,
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage AI embeddings failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as VoyageEmbeddingsResponse;
  return body.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

// FAQ取り込み時など、検索対象ドキュメントのembeddingを生成する。
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "document");
}

// 複数の質問文のembeddingを1回のAPIリクエストでまとめて生成する(検索クエリ用)。
// Voyage AIは無料枠だとRPM(リクエスト数/分)の制限が厳しいため、
// 1メッセージに複数の質問が含まれる場合でも呼び出しは1回にまとめる。
export async function embedQueries(texts: string[]): Promise<number[][]> {
  return embed(texts, "query");
}

// ユーザーの質問文のembeddingを生成する(検索クエリ用)。
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedQueries([text]);
  return embedding;
}
