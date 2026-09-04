"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { ConversationCategory, ConversationRow, ConversationStatus } from "@/types/database";

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

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [ConversationCategory, string][];
const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [ConversationStatus, string][];

export function ConversationList({ initialConversations }: { initialConversations: ConversationRow[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [isConnected, setIsConnected] = useState(true);
  const isMountedRef = useRef(true);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ConversationCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("all");
  const [matchingIds, setMatchingIds] = useState<Set<string> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) {
      setMatchingIds(null);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .select("conversation_id")
        .ilike("content", `%${trimmed}%`);

      if (error) throw error;
      setMatchingIds(new Set((data ?? []).map((m) => m.conversation_id)));
    } catch {
      setSearchError("検索に失敗しました。もう一度お試しください。");
    } finally {
      setIsSearching(false);
    }
  }

  function clearSearch() {
    setKeyword("");
    setMatchingIds(null);
    setSearchError(null);
  }

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (matchingIds !== null && !matchingIds.has(c.id)) return false;
      return true;
    });
  }, [conversations, categoryFilter, statusFilter, matchingIds]);

  return (
    <div className="flex flex-col">
      {!isConnected && (
        <div className="mx-6 mt-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600">
          接続が不安定です。再接続しています…
        </div>
      )}

      <div className="flex flex-col gap-3 border-b px-6 py-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="会話の内容をキーワード検索"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {isSearching ? "検索中…" : "検索"}
          </button>
          {matchingIds !== null && (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-lg border px-4 py-2 text-sm text-zinc-600"
            >
              クリア
            </button>
          )}
        </form>
        {searchError && <p className="text-sm text-red-600">{searchError}</p>}

        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ConversationCategory | "all")}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
          >
            <option value="all">すべてのカテゴリ</option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | "all")}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
          >
            <option value="all">すべての状態</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {(matchingIds !== null || categoryFilter !== "all" || statusFilter !== "all") && (
          <p className="text-xs text-zinc-500">{filteredConversations.length}件ヒットしました</p>
        )}
      </div>

      <div className="flex flex-col divide-y">
        {filteredConversations.length === 0 && (
          <p className="px-6 py-8 text-sm text-zinc-400">
            {conversations.length === 0 ? "問い合わせはまだありません。" : "条件に一致する問い合わせがありません。"}
          </p>
        )}
        {filteredConversations.map((c) => (
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
