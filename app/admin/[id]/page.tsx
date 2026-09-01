import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/supabase/require-operator";
import { createClient } from "@/lib/supabase/server";
import { ConversationDetail } from "@/components/admin/ConversationDetail";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default async function AdminConversationPage(props: PageProps<"/admin/[id]">) {
  const { id } = await props.params;
  const operator = await requireOperator();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) {
    notFound();
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
          ← 一覧に戻る
        </Link>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span>{operator.name}</span>
          <LogoutButton />
        </div>
      </header>

      <ConversationDetail
        conversationId={conversation.id}
        initialStatus={conversation.status}
        initialMessages={(messages ?? []).map((m) => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          createdAt: m.created_at,
        }))}
      />
    </div>
  );
}
