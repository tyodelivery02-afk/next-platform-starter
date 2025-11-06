// app/api/fcatmaker/route.js
export async function POST(req) {
  try {
    console.log("=== 转发请求到 Netlify Function ===");

    const formData = await req.formData();
    const file = formData.get("file");
    const statsData = formData.get("statsData");

    if (!file) {
      throw new Error("未上传文件");
    }

    // 读取文件并转换为 base64
    const bytes = await file.arrayBuffer();
    const base64File = Buffer.from(bytes).toString('base64');

    // 调用 Netlify Function
    const functionUrl = process.env.NETLIFY
      ? '/.netlify/functions/process_excel'
      : 'http://localhost:8888/.netlify/functions/process_excel';

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: base64File,
        statsData: JSON.parse(statsData)
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Python 处理失败');
    }

    const resultBuffer = await response.arrayBuffer();

    return new Response(resultBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=filled.xlsx",
      },
    });
  } catch (err) {
    console.error("错误:", err);

    return new Response(
      JSON.stringify({
        errorType: err.constructor.name,
        errorMessage: err.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}