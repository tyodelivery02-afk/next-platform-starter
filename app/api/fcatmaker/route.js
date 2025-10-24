// app/api/fcatmaker/route.js
import { spawn } from "child_process";
import fs from "fs";

export async function POST(req) {
  try {
    // ✅ 解析前端上传的 FormData
    const formData = await req.formData();
    const file = formData.get("file");
    const statsData = formData.get("statsData");

    if (!file) throw new Error("缺少上传的 Excel 文件");
    if (!statsData) throw new Error("缺少统计数据 statsData");

    // ✅ 把文件保存为临时文件
    const bytes = Buffer.from(await file.arrayBuffer());
    const inputPath = "./temp_input.xlsx";
    fs.writeFileSync(inputPath, bytes);

    // ✅ 调用 Python 处理 Excel
    const py = spawn("python", ["./app/api/fcatmaker/process_excel.py", inputPath, statsData]);

    let outputBuffer = Buffer.from([]);
    let errorText = "";

    py.stdout.on("data", (chunk) => {
      outputBuffer = Buffer.concat([outputBuffer, chunk]);
    });

    py.stderr.on("data", (chunk) => {
      errorText += chunk.toString();
    });

    const exitCode = await new Promise((resolve) => py.on("close", resolve));

    if (exitCode !== 0) {
      throw new Error(errorText || "Python 处理失败");
    }

    // ✅ 返回 Excel 文件给前端
    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=filled.xlsx",
      },
    });
  } catch (err) {
    console.error("Excel 处理失败:", err);
    return new Response(err.message || "Excel 处理失败", { status: 500 });
  }
}
