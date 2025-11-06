"use client";
import { useState, useRef } from "react";
import FallingImages from "components/fallingImages";
import WarningModal from "components/warning";
import LoadingModal from "components/loading";
import Image from 'next/image';

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const warningRef = useRef();

  const handleLogin = async () => {
    setLoading(true);
    try {
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
        warningRef.current?.open({ message: "パスワード不正" });
      }
    } catch (err) {
      console.error(err);
      setError("ログインエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-[#3a4a5e] via-[#2e3b4c] to-[#1e2733] overflow-hidden">
      {/* 轻微的云雾层 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.12),transparent_70%)] blur-3xl"></div>
      <FallingImages numImages={80} />

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-4">
          {/* 图片（贴合输入框顶部） */}
          <div className="absolute -top-34 left-1/2 -translate-x-1/2 w-96 h-56">
            <Image
              src="/images/witchcastle.png"
              alt="castle"
              fill
              style={{
                objectFit: "contain",
                objectPosition: "bottom center",
              }}
              className="opacity-95 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
            />
          </div>

          {/* 输入框 */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white/10 text-white placeholder-white/40 border border-white/20 rounded px-4 py-2 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            placeholder="パスワード"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="relative px-6 py-2 rounded transition bg-gray-400 hover:bg-gray-500 text-white"
        >
          ログイン
        </button>

        {error && <p className="text-red-400 mt-3">{error}</p>}
      </div>

      {/* 底部的阴影层（增加沉重感） */}
      <div className="absolute bottom-0 w-full h-40 bg-gradient-to-t from-[#0f141b] via-[#1c242f]/90 to-transparent blur-2xl"></div>

      <WarningModal ref={warningRef} />
      <LoadingModal show={loading} message="Logging..." />
    </div>
  );
}
