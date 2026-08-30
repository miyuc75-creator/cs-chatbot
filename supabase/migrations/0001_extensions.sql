-- pgvector: FAQのembedding保存・類似度検索に使用
create extension if not exists vector;

-- gen_random_uuid() 等の暗号関数用
create extension if not exists pgcrypto;
