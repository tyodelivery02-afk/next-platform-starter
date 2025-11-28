// app/api/fcatmaker/route.js
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export async function POST(req) {
  let inputPath = null;
  
  try {
    console.log("=== 开始处理请求 ===");
    console.log("环境:", process.env.NODE_ENV);
    console.log("平台:", process.env.NETLIFY ? "Netlify" : "其他");
    
    // 解析前端上传的 FormData
    const formData = await req.formData();
    const file = formData.get("file");
    const statsData = formData.get("statsData");

    console.log("文件信息:", file ? file.name : "无文件");
    console.log("statsData:", statsData);

    if (!file) {
      throw new Error("未上传文件");
    }

    // Netlify 使用 /tmp 目录
    const tmpDir = "/tmp";
    console.log("临时目录:", tmpDir);
    
    // 确保 /tmp 目录存在
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // 生成唯一的临时文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    inputPath = path.join(tmpDir, `temp_input_${timestamp}_${random}.xlsx`);
    console.log("临时文件路径:", inputPath);
    
    // 把文件保存为临时文件
    const bytes = Buffer.from(await file.arrayBuffer());
    console.log("文件大小:", bytes.length, "字节");
    fs.writeFileSync(inputPath, bytes);
    console.log("文件写入成功");

    // Python 脚本的绝对路径
    const scriptPath = path.resolve(process.cwd(), "app/api/fcatmaker/process_excel.py");
    console.log("Python 脚本路径:", scriptPath);
    console.log("脚本是否存在:", fs.existsSync(scriptPath));

    if (!fs.existsSync(scriptPath)) {
      // 尝试其他可能的路径
      const altPath = path.resolve(process.cwd(), "process_excel.py");
      console.log("尝试备用路径:", altPath);
      if (fs.existsSync(altPath)) {
        console.log("使用备用路径");
      } else {
        throw new Error(`Python 脚本不存在: ${scriptPath}`);
      }
    }

    // 检查 Python 是否可用
    const pythonCmd = process.env.NETLIFY ? "python3" : "python";
    console.log("使用 Python 命令:", pythonCmd);

    // 调用 Python 处理 Excel
    console.log("开始调用 Python 脚本...");
    const py = spawn(pythonCmd, [scriptPath, inputPath, statsData]);

    let outputBuffer = Buffer.from([]);
    let errorText = "";

    py.stdout.on("data", (chunk) => {
      console.log("Python stdout 长度:", chunk.length);
      outputBuffer = Buffer.concat([outputBuffer, chunk]);
    });

    py.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      console.error("Python stderr:", text);
      errorText += text;
    });

    const exitCode = await new Promise((resolve, reject) => {
      py.on("close", resolve);
      py.on("error", (err) => {
        console.error("spawn error:", err);
        reject(err);
      });
      
      // 设置超时（Netlify Functions 有 10 秒限制）
      setTimeout(() => {
        py.kill();
        reject(new Error("Python 脚本执行超时（10秒）"));
      }, 9000);
    });

    console.log("Python 进程退出码:", exitCode);

    if (exitCode !== 0) {
      throw new Error(`Python 处理失败 (退出码: ${exitCode})\n错误信息: ${errorText || "无错误输出"}`);
    }

    if (outputBuffer.length === 0) {
      throw new Error("Python 脚本未返回任何数据");
    }

    console.log("输出文件大小:", outputBuffer.length, "字节");
    console.log("=== 处理完成 ===");

    // 返回 Excel 文件给前端
    return new Response(outputBuffer, {
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
        headers: {
          "Content-Type": "application/json",
        }
      }
    );
  } finally {
    // 清理临时文件
    if (inputPath) {
      try {
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
          console.log("临时文件已清理:", inputPath);
        }
      } catch (cleanupErr) {
        console.warn("清理临时文件失败:", cleanupErr);
      }
    }
  }
}