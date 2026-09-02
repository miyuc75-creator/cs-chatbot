"use client";

import { useState } from "react";

type Settings = {
  escalation_emails: string[];
  business_start_hour: number;
  business_end_hour: number;
};

export function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function updateEmail(index: number, value: string) {
    const next = [...settings.escalation_emails];
    next[index] = value;
    setSettings({ ...settings, escalation_emails: next });
  }

  function addEmail() {
    setSettings({ ...settings, escalation_emails: [...settings.escalation_emails, ""] });
  }

  function removeEmail(index: number) {
    setSettings({
      ...settings,
      escalation_emails: settings.escalation_emails.filter((_, i) => i !== index),
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          escalation_emails: settings.escalation_emails.map((email) => email.trim()).filter(Boolean),
        }),
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
          有人対応が必要な問い合わせが発生した際、ここに登録した全員に通知が届きます。オペレーターの人数分、追加してください。
        </p>
        <div className="flex flex-col gap-2">
          {settings.escalation_emails.map((email, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => updateEmail(index, e.target.value)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => removeEmail(index)}
                disabled={settings.escalation_emails.length <= 1}
                className="rounded-full border px-3 py-1 text-xs disabled:opacity-40"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addEmail}
          className="w-fit rounded-full border px-3 py-1 text-xs text-zinc-600"
        >
          ＋ 通知先を追加
        </button>
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
