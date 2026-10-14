import { NextResponse } from "next/server";
import { SIGNS } from "../../../../lib/prokerala-model.mjs";
import { getJapaneseDailyHoroscope } from "../../../../lib/prokerala-server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sign = searchParams.get("sign");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = searchParams.get("date") || today;
  if (!Object.hasOwn(SIGNS, sign) || date !== today) {
    return NextResponse.json({ error: "星座と今日の日付を指定してください。" }, { status: 400 });
  }
  try {
    const data = await getJapaneseDailyHoroscope(sign, date);
    return NextResponse.json({ status: "ok", data }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "運勢を取得できませんでした。" }, { status: error.status || 502, headers: { "Cache-Control": "no-store" } });
  }
}
export const POST = GET;
