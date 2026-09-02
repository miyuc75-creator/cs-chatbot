-- 管理画面からのFAQ編集(非エンジニアによる質問・回答の追加/修正)を可能にするため、
-- オペレーターにknowledge_itemsへのCRUD権限を付与する。
-- 顧客(anon/authenticated、operators非該当)からは引き続き一切アクセスできない
-- (対応するポリシーを追加しないことで、0003で有効化したRLSにより拒否される)。

create policy "operators select all knowledge_items"
  on knowledge_items for select
  using (exists (select 1 from operators o where o.id = auth.uid()));

create policy "operators insert knowledge_items"
  on knowledge_items for insert
  with check (exists (select 1 from operators o where o.id = auth.uid()));

create policy "operators update knowledge_items"
  on knowledge_items for update
  using (exists (select 1 from operators o where o.id = auth.uid()))
  with check (exists (select 1 from operators o where o.id = auth.uid()));

create policy "operators delete knowledge_items"
  on knowledge_items for delete
  using (exists (select 1 from operators o where o.id = auth.uid()));
