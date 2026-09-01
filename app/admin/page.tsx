import Link from "next/link";
import { requireOperator } from "@/lib/supabase/require-operator";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { ConversationStatus } from "@/types/database";

function StatusBadge({ status }: { status: ConversationStatus }) {
  const color =
    status === "waiting_operator"
      ? "bg-amber-100 text-amber-900"
      : status === "operator_active"
        ? "bg-blue-100 text-blue-900"
        : status === "completed"
          ? "bg-zinc-100 text-zinc-600"
          : "bg-emerald-100 text-emerald-900";

  return <span className={`rounded-full px-3 py-1 text-xs ${color}`}>{STATUS_LABELS[status]}</span>;
}

export default async function AdminInquiryListPage() {
  const operator = await requireOperator();
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-base font-semibold">問い合わせ一覧</h1>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span>{operator.name}</span>
          <LogoutButton />
        </div>
      </header>

      <div className="flex flex-col divide-y">
        {(conversations ?? []).length === 0 && (
          <p className="px-6 py-8 text-sm text-zinc-400">問い合わせはまだありません。</p>
        )}
        {(conversations ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/admin/${c.id}`}
            className="flex items-center justify-between px-6 py-4 text-sm hover:bg-zinc-50"
          >
            <span className="text-zinc-500">
              {new Date(c.created_at).toLocaleString("ja-JP")}
            </span>
            <span>{c.category ? CATEGORY_LABELS[c.category] : "-"}</span>
            <StatusBadge status={c.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
