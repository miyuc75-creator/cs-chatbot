import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(["operator_active", "completed"]),
});

// オペレーターによる対応中/完了の切り替え。
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const parseResult = requestSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  const { conversationId, status } = parseResult.data;

  const { error } = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ status });
}
