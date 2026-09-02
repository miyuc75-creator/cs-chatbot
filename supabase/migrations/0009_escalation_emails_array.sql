-- 有人対応の通知先を複数メールアドレスに対応させる(オペレーターが複数人いるため)。
alter table app_settings add column escalation_emails text[];

update app_settings set escalation_emails = array[escalation_email_to];

alter table app_settings
  alter column escalation_emails set not null,
  add constraint app_settings_escalation_emails_not_empty
    check (array_length(escalation_emails, 1) >= 1);

alter table app_settings drop column escalation_email_to;
