"use client";

import { useState } from "react";

type Settings = {
  escalation_email_to: string;
  business_start_hour: number;
  business_end_hour: number;
};

export function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存に失敗しました");
      setSettings(data.settings);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">有人対応の通知先メールアドレス</h2>
        <p className="text-xs text-zinc-500">
          有人対応が必要な問い合わせが発生した際、このメールアドレスに通知が届きます。
        </p>
        <input
          type="email"
          value={settings.escalation_email_to}
          onChange={(e) => setSettings({ ...settings, escalation_email_to: e.target.value })}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">営業時間</h2>
        <p className="text-xs text-zinc-500">
          この時間外の問い合わせは、AIが「翌営業日に対応します」と案内します。
        </p>
        <div className="flex items-center gap-2">
          <select
            value={settings.business_start_hour}
            onChange={(e) =>
              setSettings({ ...settings, business_start_hour: Number(e.target.value) })
            }
            className="rounded-lg border px-3 py-2 text-sm outline-none"
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {hour}:00
              </option>
            ))}
          </select>
          <span className="text-sm text-zinc-500">〜</span>
          <select
            value={settings.business_end_hour}
            onChange={(e) =>
              setSettings({ ...settings, business_end_hour: Number(e.target.value) })
            }
            className="rounded-lg border px-3 py-2 text-sm outline-none"
          >
            {Array.from({ length: 24 }, (_, hour) => hour + 1).map((hour) => (
              <option key={hour} value={hour}>
                {hour}:00
              </option>
            ))}
          </select>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && <p className="text-sm text-emerald-700">保存しました。</p>}

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isSaving ? "保存中…" : "保存する"}
        </button>
      </div>
    </div>
  );
}
