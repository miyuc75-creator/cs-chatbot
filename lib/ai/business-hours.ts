const BUSINESS_START_HOUR = 10;
const BUSINESS_END_HOUR = 18;

// 営業時間(10:00〜18:00, JST)内かどうかを判定する。
// MOCK_NOWが設定されている場合はその時刻を「現在時刻」として扱う(動作確認用)。
export function isWithinBusinessHours(now: Date = getCurrentTime()): boolean {
  // 数値だけを取り出したいのでen-USを指定する("ja-JP"は"14時"のように単位が付き、Number()がNaNになる)。
  const jstHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );

  return jstHour >= BUSINESS_START_HOUR && jstHour < BUSINESS_END_HOUR;
}

function getCurrentTime(): Date {
  return process.env.MOCK_NOW ? new Date(process.env.MOCK_NOW) : new Date();
}
