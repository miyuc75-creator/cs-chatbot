process.loadEnvFile(".env.local");

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { embedDocuments } from "@/lib/rag/embed";
import type { Database } from "@/types/database";
import type { FaqCsvRow, FaqRecord } from "@/types/faq";

async function loadFaqRecords(): Promise<FaqRecord[]> {
  const csvPath = path.join(process.cwd(), "data", "faq.csv");
  const csvContent = await readFile(csvPath, "utf-8");

  const rows: FaqCsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  return rows.map((row) => ({
    question: row.質問,
    answer: row.回答,
    category: row.カテゴリ,
  }));
}

async function main() {
  const records = await loadFaqRecords();
  console.log(`FAQ ${records.length}件を読み込みました。Embeddingを生成します...`);

  // 検索クエリは常に「顧客の質問文」なので、embeddingもFAQの質問文だけを対象にする
  // (回答文まで含めると質問同士の類似度がぼやけ、検索精度が落ちる)。
  const embeddings = await embedDocuments(records.map((r) => r.question));

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 再実行しても重複しないよう、毎回全件洗い替えする。
  const { error: deleteError } = await supabase
    .from("knowledge_items")
    .delete()
    .not("id", "is", null);
  if (deleteError) {
    throw new Error(`既存FAQの削除に失敗しました: ${deleteError.message}`);
  }

  const rowsToInsert = records.map((record, index) => ({
    question: record.question,
    answer: record.answer,
    category: record.category,
    embedding: embeddings[index],
  }));

  const { error: insertError } = await supabase.from("knowledge_items").insert(rowsToInsert);
  if (insertError) {
    throw new Error(`FAQの登録に失敗しました: ${insertError.message}`);
  }

  console.log(`${rowsToInsert.length}件のFAQをknowledge_itemsへ登録しました。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
