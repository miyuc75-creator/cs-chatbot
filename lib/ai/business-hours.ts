import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_START_HOUR = 10;
const DEFAULT_END_HOUR = 18;

// 営業時間(JST)内かどうかを判定する。開始・終了時刻は管理画面(app_settings)で設定可能。
// MOCK_NOWが設定されている場合はその時刻を「現在時刻」として扱う(動作確認用)。
export async function isWithinBusinessHours(now: Date = getCurrentTime()): Promise<boolean> {
  const { start, end } = await getBusinessHours();

  // 数値だけを取り出したいのでen-USを指定する("ja-JP"は"14時"のように単位が付き、Number()がNaNになる)。
  const jstHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );

  return jstHour >= start && jstHour < end;
}

export async function getBusinessHours(): Promise<{ start: number; end: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("business_start_hour, business_end_hour")
    .eq("id", 1)
    .single();

  if (error || !data) {
    console.error("営業時間設定の取得に失敗したため、デフォルト値を使用します:", error);
    return { start: DEFAULT_START_HOUR, end: DEFAULT_END_HOUR };
  }

  return { start: data.business_start_hour, end: data.business_end_hour };
}

function getCurrentTime(): Date {
  return process.env.MOCK_NOW ? new Date(process.env.MOCK_NOW) : new Date();
}
