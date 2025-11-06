// app/api/fcatmaker/route.js
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(req) {
  try {
    // 解析前端上传的 FormData
    const formData = await req.formData();
    const file = formData.get("file");
    const statsData = formData.get("statsData");

    // 使用系统临时目录或 /tmp（适用于大多数云平台）
    const tmpDir = process.env.VERCEL ? "/tmp" : os.tmpdir();
    
    // 生成唯一的临时文件名，避免并发冲突
    const timestamp = Date.now();
    const inputPath = path.join(tmpDir, `temp_input_${timestamp}.xlsx`);
    
    // 把文件保存为临时文件
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(inputPath, bytes);

    // 调用 Python 处理 Excel
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

    // 清理临时文件
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch (cleanupErr) {
      console.warn("清理临时文件失败:", cleanupErr);
    }

    if (exitCode !== 0) {
      throw new Error(errorText || "Python 处理失败");
    }

    // 返回 Excel 文件给前端
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