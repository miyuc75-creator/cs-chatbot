alter table conversations enable row level security;
alter table messages enable row level security;
alter table knowledge_items enable row level security;
alter table operators enable row level security;

-- conversations -----------------------------------------------------------

create policy "customers select own conversations"
  on conversations for select
  using (customer_id = auth.uid());

create policy "customers insert own conversations"
  on conversations for insert
  with check (customer_id = auth.uid());

create policy "operators select all conversations"
  on conversations for select
  using (exists (select 1 from operators o where o.id = auth.uid()));

create policy "operators update all conversations"
  on conversations for update
  using (exists (select 1 from operators o where o.id = auth.uid()))
  with check (exists (select 1 from operators o where o.id = auth.uid()));

-- messages ------------------------------------------------------------------

create policy "customers select own conversation messages"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.customer_id = auth.uid()
    )
  );

create policy "customers insert own conversation messages"
  on messages for insert
  with check (
    sender = 'customer'
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.customer_id = auth.uid()
    )
  );

create policy "operators select all messages"
  on messages for select
  using (exists (select 1 from operators o where o.id = auth.uid()));

create policy "operators insert messages"
  on messages for insert
  with check (
    sender = 'operator'
    and exists (select 1 from operators o where o.id = auth.uid())
  );

-- knowledge_items -------------------------------------------------------------
-- クライアント(anon/authenticated)からは一切アクセスさせない。
-- RAGパイプラインはNext.jsのAPI Route内でservice roleクライアントからのみアクセスする。
-- (ポリシーを定義しないことで、RLS有効化により全アクセスがデフォルト拒否される)

-- operators ---------------------------------------------------------------

create policy "operators select self"
  on operators for select
  using (id = auth.uid());
