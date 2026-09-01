import type { ChatMessage } from "@/types/chat";

const SENDER_STYLES: Record<ChatMessage["sender"], string> = {
  customer: "self-end bg-emerald-600 text-white",
  ai: "self-start bg-zinc-100 text-zinc-900",
  operator: "self-start bg-emerald-100 text-emerald-950",
};

const SENDER_LABELS: Record<ChatMessage["sender"], string> = {
  customer: "あなた",
  ai: "AI",
  operator: "オペレーター",
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`flex max-w-[80%] flex-col gap-1 rounded-2xl px-4 py-2 ${SENDER_STYLES[message.sender]}`}>
      <span className="text-xs opacity-70">{SENDER_LABELS[message.sender]}</span>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
    </div>
  );
}
