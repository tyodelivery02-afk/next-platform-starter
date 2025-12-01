export async function POST(req) {
  try {
    console.log("=== 开始处理请求 ===");

    // 解析前端上传的 FormData
    const formData = await req.formData();
    const file = formData.get("file");
    const statsData = formData.get("statsData");

    if (!file) {
      return new Response(JSON.stringify({ error: "未上传文件" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    console.log("文件信息:", file.name);
    console.log("statsData:", statsData);

    // 读取 Excel 文件二进制
    const fileBytes = Buffer.from(await file.arrayBuffer());

    // 通过 FormData 调用 Python API
    const form = new FormData();
    form.append("file", new Blob([fileBytes]), file.name);
    form.append("statsData", statsData);

    console.log("开始调用 Python API...");

    const pythonRes = await fetch("https://python-excel-api-iurk.onrender.com/process", {
      method: "POST",
      body: form,
    });

    if (!pythonRes.ok) {
      const errText = await pythonRes.text();
      throw new Error(`Python API 调用失败: ${errText}`);
    }

    // 获取返回的 Excel bytes
    const excelBytes = Buffer.from(await pythonRes.arrayBuffer());

    console.log("Python API 调用完成，文件大小:", excelBytes.length, "字节");

    // 返回 Excel 文件给前端
    return new Response(excelBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=filled.xlsx",
      },
    });

  } catch (err) {
    console.error("=== 错误详情 ===");
    console.error("错误类型:", err.constructor.name);
    console.error("错误消息:", err.message);
    console.error("错误堆栈:", err.stack);

    return new Response(
      JSON.stringify({
        errorType: err.constructor.name,
        errorMessage: err.message || "Excel 处理失败",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
