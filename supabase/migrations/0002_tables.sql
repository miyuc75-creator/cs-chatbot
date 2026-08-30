-- conversations: 問い合わせ単位
create table conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ai_active'
    check (status in ('ai_active', 'waiting_operator', 'operator_active', 'completed')),
  category text
    check (category in ('return_exchange', 'product_question', 'general_question', 'complaint', 'undetermined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_customer_id_idx on conversations (customer_id);
create index conversations_status_idx on conversations (status);
create index conversations_created_at_idx on conversations (created_at desc);

-- messages: チャット履歴
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender text not null check (sender in ('customer', 'ai', 'operator')),
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on messages (conversation_id, created_at);

-- knowledge_items: FAQ（data/faq.csv を取り込んで格納する）
create table knowledge_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null, -- 在庫/配送/返品/商品質問/その他（faq.csv由来の語彙）
  embedding vector(512), -- Voyage AI voyage-3-lite の出力次元数
  created_at timestamptz not null default now()
);

-- operators: 管理画面利用者
create table operators (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'operator',
  created_at timestamptz not null default now()
);

-- updated_at 自動更新
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_set_updated_at
  before update on conversations
  for each row
  execute function set_updated_at();
