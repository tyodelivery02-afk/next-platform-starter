// app/api/servertime/route.js
export async function GET() {
  const serverTime = new Date(); // 服务器时间
  return new Response(JSON.stringify({ serverTime: serverTime.toISOString() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
