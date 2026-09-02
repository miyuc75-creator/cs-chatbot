import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { embedDocuments } from "@/lib/rag/embed";

const createSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(100),
});

// FAQ一覧取得。operators以外はRLSにより空配列になる。
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("knowledge_items")
    .select("id, question, answer, category, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ items: data });
}

// FAQ新規追加。質問文からEmbeddingを生成してから登録する。
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const parseResult = createSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  const { question, answer, category } = parseResult.data;

  let embedding: number[];
  try {
    [embedding] = await embedDocuments([question]);
  } catch (error) {
    console.error("Embedding生成に失敗しました:", error);
    return NextResponse.json(
      { error: "Embeddingの生成に失敗しました。時間をおいて再度お試しください。" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({ question, answer, category, embedding })
    .select("id, question, answer, category, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ item: data });
}
