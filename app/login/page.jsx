"use client";
import { useState, useRef } from "react";
import FallingImages from "components/fallingImages";
import WarningModal from "components/warning";
import LoadingModal from "components/loading";

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
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-900 overflow-hidden">
      <FallingImages numImages={150} />

      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-white text-2xl font-bold mb-4 drop-shadow-lg">
          パスワード
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
          disabled={loading}
          className="px-6 py-2 rounded transition bg-blue-600 hover:bg-blue-700 text-white"
        >
          ログイン
        </button>
        {error && <p className="text-red-500 mt-2 drop-shadow-lg">{error}</p>}
      </div>

      <WarningModal ref={warningRef} />
      <LoadingModal show={loading} message="Logging..." />
    </div>
  );
}
