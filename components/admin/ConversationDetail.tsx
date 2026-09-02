"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminMessageBubble } from "./AdminMessageBubble";
import { STATUS_LABELS } from "@/lib/labels";
import type { ChatMessage } from "@/types/chat";
import type { ConversationStatus } from "@/types/database";

export function ConversationDetail({
  conversationId,
  initialMessages,
  initialStatus,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  initialStatus: ConversationStatus;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    // 切断中に届いていた分を含め、会話の最新状態をサーバーから取り直す。
    async function resync() {
      const [{ data: messageRows }, { data: conversationRow }] = await Promise.all([
        supabase
          .from("messages")
          .select("id, sender, content, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true }),
        supabase.from("conversations").select("status").eq("id", conversationId).single(),
      ]);

      if (messageRows) {
        setMessages(
          messageRows.map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            createdAt: m.created_at,
          }))
        );
      }
      if (conversationRow) {
        setStatus(conversationRow.status);
      }
    }

    const channel = supabase
      .channel(`admin-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender: ChatMessage["sender"];
            content: string;
            created_at: string;
          };
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { id: row.id, sender: row.sender, content: row.content, createdAt: row.created_at }]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { status: ConversationStatus };
          setStatus(row.status);
        }
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") {
          setIsConnected(true);
          resync();
        } else if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT" || subscribeStatus === "CLOSED") {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendReply() {
    const content = input.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setInput("");

    try {
      await fetch("/api/admin/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });
    } finally {
      setIsSending(false);
    }
  }

  async function updateStatus(nextStatus: "operator_active" | "completed") {
    await fetch("/api/admin/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, status: nextStatus }),
    });
    setStatus(nextStatus);
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <span className="text-sm text-zinc-600">状態: {STATUS_LABELS[status]}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => updateStatus("operator_active")}
            disabled={status === "operator_active"}
            className="rounded-full border px-3 py-1 text-xs disabled:opacity-40"
          >
            対応中にする
          </button>
          <button
            type="button"
            onClick={() => updateStatus("completed")}
            disabled={status === "completed"}
            className="rounded-full border px-3 py-1 text-xs disabled:opacity-40"
          >
            完了にする
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
        {!isConnected && (
          <div className="rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600">
            接続が不安定です。再接続しています…
          </div>
        )}
        {messages.map((message) => (
          <AdminMessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendReply();
        }}
        className="flex gap-2 border-t p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending}
          placeholder="返信を入力"
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          送信
        </button>
      </form>
    </div>
  );
}
