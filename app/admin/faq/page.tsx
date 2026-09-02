import Link from "next/link";
import { requireOperator } from "@/lib/supabase/require-operator";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { FaqManager } from "@/components/admin/FaqManager";

export default async function AdminFaqPage() {
  const operator = await requireOperator();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("knowledge_items")
    .select("id, question, answer, category, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
            ← 一覧に戻る
          </Link>
          <h1 className="text-base font-semibold">FAQ管理</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span>{operator.name}</span>
          <LogoutButton />
        </div>
      </header>

      <FaqManager initialItems={items ?? []} />
    </div>
  );
}
