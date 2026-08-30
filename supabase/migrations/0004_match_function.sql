-- FAQのベクトル類似度検索。service roleからのみ呼び出す想定。
create or replace function match_knowledge_items(
  query_embedding vector(512),
  match_count int default 3
)
returns table (
  id uuid,
  question text,
  answer text,
  category text,
  similarity float
)
language sql
stable
as $$
  select
    id,
    question,
    answer,
    category,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_items
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
