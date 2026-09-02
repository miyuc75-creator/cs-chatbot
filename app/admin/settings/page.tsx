import Link from "next/link";
import { requireOperator } from "@/lib/supabase/require-operator";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const operator = await requireOperator();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("app_settings")
    .select("escalation_email_to, business_start_hour, business_end_hour")
    .eq("id", 1)
    .single();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
            ← 一覧に戻る
          </Link>
          <h1 className="text-base font-semibold">通知・営業時間設定</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span>{operator.name}</span>
          <LogoutButton />
        </div>
      </header>

      {settings ? (
        <SettingsForm initialSettings={settings} />
      ) : (
        <p className="px-6 py-8 text-sm text-red-600">設定の取得に失敗しました。</p>
      )}
    </div>
  );
}
