"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageBubble } from "./MessageBubble";
import { StatusBanner } from "./StatusBanner";
import type { ChatMessage, ChatSendResponse } from "@/types/chat";
import type { ConversationStatus } from "@/types/database";

export function ChatWindow() {
  const [isReady, setIsReady] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConversationStatus>("ai_active");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasStartedAuthRef = useRef(false);

  useEffect(() => {
    // StrictModeの開発時二重実行でsignInAnonymously()が2回走り、
    // Supabaseのレート制限に達しやすくなるのを防ぐ。
    if (hasStartedAuthRef.current) return;
    hasStartedAuthRef.current = true;

    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          setError("セッションの開始に失敗しました。ページを再読み込みしてください。");
          hasStartedAuthRef.current = false;
          return;
        }
      }
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 有人対応中、オペレーターからの返信・ステータス変更を即時反映する。
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`customer-conversation-${conversationId}`)
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
          if (row.sender !== "operator") return; // customer/aiは自分の送受信で既に反映済み
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: "customer", content: text, createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });

      if (!res.ok) {
        throw new Error("送信に失敗しました");
      }

      const data: ChatSendResponse = await res.json();
      setConversationId(data.conversationId);
      setStatus(data.status);
      setMessages((prev) => [...prev, data.reply]);
    } catch {
      setError("メッセージの送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSending(false);
    }
  }

  async function requestOperator() {
    if (!conversationId || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (!res.ok) {
        throw new Error("切り替えに失敗しました");
      }

      const data: ChatSendResponse = await res.json();
      setStatus(data.status);
      setMessages((prev) => [...prev, data.reply]);
    } catch {
      setError("オペレーターへの切り替えに失敗しました。もう一度お試しください。");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-base font-semibold">カスタマーサポート</h1>
        <button
          type="button"
          onClick={requestOperator}
          disabled={!conversationId || isSending}
          className="rounded-full border px-3 py-1 text-xs text-zinc-600 disabled:opacity-40"
        >
          オペレーターに相談
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {status !== "ai_active" && <StatusBanner status={status} />}
        {messages.length === 0 && (
          <p className="text-sm text-zinc-400">お困りごとをお気軽にご質問ください。</p>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex gap-2 border-t p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!isReady || isSending}
          placeholder="メッセージを入力"
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={!isReady || isSending || !input.trim()}
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          送信
        </button>
      </form>
    </div>
  );
}
