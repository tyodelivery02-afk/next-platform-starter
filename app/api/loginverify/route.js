import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
import bcrypt from "bcryptjs";

const sql = neon();

export async function POST(request) {
  const { password } = await request.json();
  if (!password) return NextResponse.json({ success: false });

  try {
    const result = await sql`SELECT value FROM sys_config WHERE key = 'password'`;
    const hashedPassword = result[0]?.value;

    if (await bcrypt.compare(password, hashedPassword)) {
      const token = "loggedin";
      const res = NextResponse.json({ success: true, token });
      return res;
    }

    return NextResponse.json({ success: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}

// GET 用于验证 token
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  return NextResponse.json({ loggedIn: token === "loggedin" });
}
