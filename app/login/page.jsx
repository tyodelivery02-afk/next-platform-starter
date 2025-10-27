"use client";
import { useState } from "react";
import FallingImages from 'components/fallingImages';

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const res = await fetch("/api/loginverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem("sessionToken", data.token);
      window.location.reload();
    } else {
      setError("パスワード不正");
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-900
 overflow-hidden">
      {/* 飘落背景 */}
      <FallingImages numImages={150} />

      {/* 登录输入融入背景 */}
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-white text-2xl font-bold mb-4 drop-shadow-lg">
          パスワード入力
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-white/20 text-white placeholder-white/50 border border-white/30 rounded px-4 py-2 mb-4 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          placeholder="パスワード"
        />
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition"
        >
          ログイン
        </button>
        {error && (
          <p className="text-red-500 mt-2 drop-shadow-lg">{error}</p>
        )}
      </div>
    </div>
  );
}
