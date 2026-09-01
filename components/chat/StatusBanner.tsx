import type { ConversationStatus } from "@/types/database";

const STATUS_LABELS: Partial<Record<ConversationStatus, string>> = {
  waiting_operator: "オペレーターへの対応をお待ちいただいています",
  operator_active: "オペレーターが対応中です",
  completed: "この問い合わせは完了しました",
};

const STATUS_STYLES: Partial<Record<ConversationStatus, string>> = {
  waiting_operator: "bg-amber-50 text-amber-900",
  operator_active: "bg-amber-50 text-amber-900",
  completed: "bg-zinc-100 text-zinc-600",
};

export function StatusBanner({ status }: { status: ConversationStatus }) {
  const label = STATUS_LABELS[status];
  if (!label) return null;

  return (
    <div className={`rounded-lg px-4 py-2 text-sm ${STATUS_STYLES[status]}`}>{label}</div>
  );
}
