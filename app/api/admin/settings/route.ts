import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";

const updateSchema = z
  .object({
    escalation_email_to: z.string().trim().email(),
    business_start_hour: z.number().int().min(0).max(23),
    business_end_hour: z.number().int().min(1).max(24),
  })
  .refine((data) => data.business_start_hour < data.business_end_hour, {
    message: "開始時刻は終了時刻より前である必要があります",
  });

// 通知先メールアドレス・営業時間の設定を取得する。
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("escalation_email_to, business_start_hour, business_end_hour")
    .eq("id", 1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ settings: data });
}

// 通知先メールアドレス・営業時間の設定を更新する。
export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const parseResult = updateSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message ?? "不正なリクエストです" },
      { status: 400 }
    );
  }
  const { escalation_email_to, business_start_hour, business_end_hour } = parseResult.data;

  const { data, error } = await supabase
    .from("app_settings")
    .update({ escalation_email_to, business_start_hour, business_end_hour })
    .eq("id", 1)
    .select("escalation_email_to, business_start_hour, business_end_hour")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ settings: data });
}
