import type { ConversationStatus } from "@/types/database";

const STATUS_LABELS: Partial<Record<ConversationStatus, string>> = {
  waiting_operator: "オペレーターへの対応をお待ちいただいています",
  operator_active: "オペレーターが対応中です",
  completed: "この問い合わせは完了しました",
};

export function StatusBanner({ status }: { status: ConversationStatus }) {
  const label = STATUS_LABELS[status];
  if (!label) return null;

  return (
    <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">{label}</div>
  );
}
