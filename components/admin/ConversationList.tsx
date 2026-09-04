"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { ConversationRow, ConversationStatus } from "@/types/database";

function StatusBadge({ status }: { status: ConversationStatus }) {
  const color =
    status === "waiting_operator"
      ? "bg-amber-100 text-amber-900"
      : status === "operator_active"
        ? "bg-emerald-600 text-white"
        : status === "completed"
          ? "bg-zinc-100 text-zinc-600"
          : "bg-emerald-100 text-emerald-900";

  return <span className={`rounded-full px-3 py-1 text-xs ${color}`}>{STATUS_LABELS[status]}</span>;
}

export function ConversationList({ initialConversations }: { initialConversations: ConversationRow[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [isConnected, setIsConnected] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const supabase = createClient();

    // 切断中に届いていた分を含め、一覧をサーバーから取り直す。
    async function resync() {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: false });
      if (data && isMountedRef.current) {
        setConversations(data);
      }
    }

    const channel = supabase
      .channel("admin-conversation-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        (payload) => {
          const row = payload.new as ConversationRow;
          setConversations((prev) =>
            prev.some((c) => c.id === row.id) ? prev : [row, ...prev]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload) => {
          const row = payload.new as ConversationRow;
          setConversations((prev) => prev.map((c) => (c.id === row.id ? row : c)));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          resync();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsConnected(false);
        }
      });

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col">
      {!isConnected && (
        <div className="mx-6 mt-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600">
          接続が不安定です。再接続しています…
        </div>
      )}
      <div className="flex flex-col divide-y">
        {conversations.length === 0 && (
          <p className="px-6 py-8 text-sm text-zinc-400">問い合わせはまだありません。</p>
        )}
        {conversations.map((c) => (
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
