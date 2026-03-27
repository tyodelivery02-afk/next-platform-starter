"use client";
import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { hidePaths } from "app/config/config";
import { X } from "phosphor-react";

export function FloatingCharacter() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const [messages, setMessages] = useState([
    {
      role: "model",
      text: "やっほー、なにしとるん？",
    },
  ]);

  const shouldHide = hidePaths.includes(pathname);
  if (shouldHide) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          history: nextMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "请求失败");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: data.reply || "すみません、返答できませんでした。",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: `エラー：${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-8 right-1 z-50 flex flex-col items-end text-black">
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center hover:scale-105 transition active:scale-95"
        >
          <Image
            src="/images/syuuko.png"
            alt="open"
            width={32}
            height={32}
            style={{ objectFit: "contain" }}
          />
        </button>
      )}

      {!collapsed && (
        <div className="flex flex-col items-end">
          {chatOpen && (
            <div
              className="
    mb-2 rounded-2xl bg-white/90 shadow-xl border border-gray-200
    flex flex-col overflow-hidden
    resize both
    min-w-[260px] min-h-[220px]
    max-w-[90vw] max-h-[70vh]
    w-[50px] h-[30px]
  "
            >

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${msg.role === "user"
                        ? "bg-pink-200 text-black"
                        : "bg-gray-100 text-black"
                        }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm bg-gray-100 text-gray-500">
                      入力中...
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t p-2 flex items-end gap-2 bg-white shrink-0">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力..."
                  rows={2}
                  className="flex-1 resize-none input-item px-3 py-2 text-sm outline-none focus:border-pink-400"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="send-button text-sm font-medium"
                >
                  送信
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center">
            <div
              className="w-30 h-30 cursor-pointer"
              onClick={() => setChatOpen((prev) => !prev)}
            >
              <Image
                src="/images/syuuko.png"
                alt="assistant"
                width={100}
                height={100}
                style={{ objectFit: "contain" }}
                className="transition-transform duration-300 hover:scale-110 hover:-translate-y-1"
              />
            </div>

            <button
              onClick={() => setCollapsed(true)}
              className="bg-pink-200 hover:bg-pink-300 border px-2 py-2 mr-3 border-white text-black orther-button mt-1"
            >
              <X size={10} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}