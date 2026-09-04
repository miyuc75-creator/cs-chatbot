import Link from "next/link";
import { requireOperator } from "@/lib/supabase/require-operator";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { ConversationList } from "@/components/admin/ConversationList";

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
          <Link href="/admin/faq" className="hover:underline">
            FAQ管理
          </Link>
          <Link href="/admin/settings" className="hover:underline">
            通知設定
          </Link>
          <span>{operator.name}</span>
          <LogoutButton />
        </div>
      </header>

      <ConversationList initialConversations={conversations ?? []} />
    </div>
  );
}
