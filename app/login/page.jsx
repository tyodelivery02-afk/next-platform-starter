"use client";
import { useState } from "react";

// 下落元素数量
const NUM_IMAGES = 70;

// 用一组你想飘落的图片URL
const IMAGE_URLS = ["/images/livecat/ご安全に.png", "/images/livecat/ご安全に2.png"];

function FallingImages() {
  const [images] = useState(
    Array.from({ length: NUM_IMAGES }).map(() => ({
      url: IMAGE_URLS[Math.floor(Math.random() * IMAGE_URLS.length)],
      left: Math.random() * 100,
      size: 20 + Math.random() * 40,
      duration: 5 + Math.random() * 10,
      delay: Math.random() * 5,
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {images.map((img, idx) => (
        <img
          key={idx}
          src={img.url}
          className="absolute"
          style={{
            left: `${img.left}%`,
            width: `${img.size}px`,
            height: "auto",
            animation: `fall ${img.duration}s linear ${img.delay}s infinite`,
            objectFit: "contain",
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-50px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(360deg);
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

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
      <FallingImages />

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
