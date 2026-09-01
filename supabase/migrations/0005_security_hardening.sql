-- pgvector拡張をpublicスキーマからextensionsスキーマへ移動(Database Linter: extension_in_public対応)
alter extension vector set schema extensions;

-- 関数のsearch_pathを固定し、search_path hijackingを防止(Database Linter: function_search_path_mutable対応)
alter function public.set_updated_at() set search_path = '';
alter function public.match_knowledge_items(vector, int) set search_path = public, extensions;
