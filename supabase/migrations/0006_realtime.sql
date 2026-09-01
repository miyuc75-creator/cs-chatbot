-- 管理画面での有人チャットを顧客側にリアルタイム反映するため、messagesをRealtimeに公開する。
-- conversationsもステータス変更(対応中/完了など)の即時反映に使う。
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
