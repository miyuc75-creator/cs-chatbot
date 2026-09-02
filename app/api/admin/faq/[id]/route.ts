import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { embedDocuments } from "@/lib/rag/embed";

const updateSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(100),
});

// FAQ更新。質問文が変わるとFAQ検索の精度に関わるため、常にEmbeddingを再生成する。
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const parseResult = updateSchema.safeParse(await request.json());
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
    .update({ question, answer, category, embedding })
    .eq("id", id)
    .select("id, question, answer, category, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { error } = await supabase.from("knowledge_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
