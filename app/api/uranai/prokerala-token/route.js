import { NextResponse } from "next/server";
import { getProkeralaToken } from "../../../../lib/prokerala-server";

export async function GET() {
  try {
    const token = await getProkeralaToken();
    return NextResponse.json({ access_token: token.access_token, expires_in: Math.floor((token.expires_at - Date.now()) / 1000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 502 });
  }
}
export const POST = GET;
