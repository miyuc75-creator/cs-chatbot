-- 通知先メールアドレス・営業時間など、頻繁ではないが非エンジニアが変更したい設定値を
-- Vercelの環境変数やコード直書き(エンジニア操作が必要)ではなく管理画面から編集できるようにする。
-- 単一行のみを持つ設定テーブル(id=1固定)。
create table app_settings (
  id integer primary key default 1,
  escalation_email_to text not null,
  business_start_hour smallint not null default 10 check (business_start_hour between 0 and 23),
  business_end_hour smallint not null default 18 check (business_end_hour between 0 and 24),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1),
  constraint app_settings_business_hours_order check (business_start_hour < business_end_hour)
);

-- 既存のESCALATION_EMAIL_TO環境変数・business-hours.tsのハードコード値を初期値として投入する。
insert into app_settings (id, escalation_email_to, business_start_hour, business_end_hour)
values (1, 'miyuc75@gmail.com', 10, 18);

alter table app_settings enable row level security;

create policy "operators select app_settings"
  on app_settings for select
  using (exists (select 1 from operators o where o.id = auth.uid()));

create policy "operators update app_settings"
  on app_settings for update
  using (exists (select 1 from operators o where o.id = auth.uid()))
  with check (exists (select 1 from operators o where o.id = auth.uid()));

create trigger set_app_settings_updated_at
  before update on app_settings
  for each row execute function set_updated_at();
