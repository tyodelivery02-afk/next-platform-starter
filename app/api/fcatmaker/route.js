// app/api/fcatmaker/route.js
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export async function POST(req) {
  let inputPath = null;
  let outputPath = null;
  
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const statsData = formData.get("statsData");

    if (!file) {
      throw new Error("未上传文件");
    }

    const tmpDir = "/tmp";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    inputPath = path.join(tmpDir, `temp_input_${timestamp}_${random}.xlsx`);
    outputPath = inputPath.replace(".xlsx", "_filled.xlsx");
    
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(inputPath, bytes);

    const scriptPath = path.resolve(process.cwd(), "app/api/fcatmaker/process_excel.py");
    
    // 设置 PYTHONPATH 包含我们安装的库
    const pythonLibPath = path.resolve(process.cwd(), "python_libs");
    
    const py = spawn("python3", [scriptPath, inputPath, statsData], {
      env: {
        ...process.env,
        PYTHONPATH: pythonLibPath,
        PYTHONUNBUFFERED: "1",
      }
    });

    let outputBuffer = Buffer.from([]);
    let errorText = "";

    py.stdout.on("data", (chunk) => {
      outputBuffer = Buffer.concat([outputBuffer, chunk]);
    });

    py.stderr.on("data", (chunk) => {
      errorText += chunk.toString();
    });

    const exitCode = await new Promise((resolve, reject) => {
      py.on("close", resolve);
      py.on("error", reject);
      
      setTimeout(() => {
        py.kill();
        reject(new Error("超时"));
      }, 25000);
    });

    if (exitCode !== 0) {
      throw new Error(`Python 失败: ${errorText}`);
    }

    if (outputBuffer.length === 0) {
      throw new Error("无输出数据");
    }

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=filled.xlsx",
      },
    });
  } catch (err) {
    console.error("错误:", err.message);
    
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
  } finally {
    [inputPath, outputPath].forEach(p => {
      if (p && fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {}
      }
    });
  }
}