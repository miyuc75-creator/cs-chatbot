"use client";

import { useState } from "react";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  created_at: string;
};

type FormState = {
  question: string;
  answer: string;
  category: string;
};

const EMPTY_FORM: FormState = { question: "", answer: "", category: "" };

export function FaqManager({ initialItems }: { initialItems: FaqItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAdd() {
    setEditingId(null);
    setIsAdding(true);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function startEdit(item: FaqItem) {
    setIsAdding(false);
    setEditingId(item.id);
    setForm({ question: item.question, answer: item.answer, category: item.category });
    setError(null);
  }

  function cancelForm() {
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  }

  async function saveNew() {
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "追加に失敗しました");
      setItems((prev) => [data.item, ...prev]);
      setIsAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新に失敗しました");
      setItems((prev) => prev.map((item) => (item.id === id ? data.item : item)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("このFAQを削除します。よろしいですか？")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          ここで追加・編集した内容は、保存すると自動でチャットの自動応答に反映されます（数秒かかる場合があります）。
        </p>
        {!isAdding && (
          <button
            type="button"
            onClick={startAdd}
            className="shrink-0 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white"
          >
            ＋ 新しいFAQを追加
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isAdding && (
        <FaqForm
          form={form}
          setForm={setForm}
          isSaving={isSaving}
          onSave={saveNew}
          onCancel={cancelForm}
          saveLabel="追加する"
        />
      )}

      <div className="flex flex-col gap-3">
        {items.length === 0 && !isAdding && (
          <p className="py-8 text-center text-sm text-zinc-400">FAQはまだ登録されていません。</p>
        )}
        {items.map((item) =>
          editingId === item.id ? (
            <FaqForm
              key={item.id}
              form={form}
              setForm={setForm}
              isSaving={isSaving}
              onSave={() => saveEdit(item.id)}
              onCancel={cancelForm}
              saveLabel="保存する"
            />
          ) : (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {item.category}
                  </span>
                  <p className="text-sm font-medium">{item.question}</p>
                  <p className="whitespace-pre-wrap text-sm text-zinc-600">{item.answer}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded-full border px-3 py-1 text-xs"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function FaqForm({
  form,
  setForm,
  isSaving,
  onSave,
  onCancel,
  saveLabel,
}: {
  form: FormState;
  setForm: (form: FormState) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600">カテゴリ</label>
        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="例: 配送、返品、商品質問"
          className="rounded-lg border px-3 py-2 text-sm outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600">質問</label>
        <input
          type="text"
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          placeholder="お客様からよく届く質問文"
          className="rounded-lg border px-3 py-2 text-sm outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600">回答</label>
        <textarea
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          placeholder="自動応答として返す回答文"
          rows={4}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full border px-4 py-1.5 text-sm">
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {isSaving ? "保存中…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
