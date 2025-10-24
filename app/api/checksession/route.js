import { NextResponse } from "next/server";

export async function GET() {
  const cookie = request.cookies.get("sessionToken")?.value;
  return NextResponse.json({ loggedIn: cookie === "loggedin" });
}
