import type { CookieOptionsWithName } from "@supabase/ssr";

// 顧客用チャットはShopify等の別ドメインにiframe埋め込みされる想定のため、
// 本番ではCookieをサードパーティ(クロスサイト)コンテキストでも送信できるようにする。
// SameSite=NoneはSecure(HTTPS)必須で、ローカル開発(http://localhost)では
// ブラウザによって扱いが不安定なため、本番でのみ適用する。
//
// 注意: SafariのITP(Intelligent Tracking Prevention)は、Cookie属性に関わらず
// サードパーティCookieを既定でブロックするため、Safari上でのiframe埋め込みでは
// セッションが永続化されない(リロードのたびに匿名認証がやり直しになる)制約が残る。
export function getCookieOptions(): CookieOptionsWithName | undefined {
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }
  return { sameSite: "none", secure: true };
}
