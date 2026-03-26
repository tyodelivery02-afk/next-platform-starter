"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
// 假设这些配置文件的路径是正确的
import { hidePaths, messages } from "app/config/config";
import { X } from "phosphor-react";

export function FloatingCharacter() {
  const pathname = usePathname();
  const [showBubble, setShowBubble] = useState(false);
  const [index, setIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(false); // 控制主区域和折叠图标的切换

  // 获取当前页面的消息，如果不存在则使用默认消息
  const currentMessages = messages[pathname] || ["がんばろう！"];

  // 路径变化时，重置消息索引并显示气泡
  useEffect(() => {
    setIndex(0);
    setShowBubble(true);
  }, [pathname]);

  // 点击角色图片时切换到下一条消息
  const handleClick = () => {
    setIndex((prev) => (prev + 1) % currentMessages.length);
  };

  // 根据配置判断是否在当前路径隐藏组件
  const shouldHide = hidePaths.includes(pathname);
  if (shouldHide) return null;

  // 保持顶层容器固定定位
  return (
    <div className="fixed bottom-8 text-black right-1 z-50 flex flex-col items-end">
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center
                     hover:scale-105 transition active:scale-95"
        >
          <Image
            src="/images/Q2.png"
            alt="open"
            width={32}
            height={32}
            style={{ objectFit: "contain" }}
          />
        </button>
      )}

      {!collapsed && (
        <div
          className={`
            flex flex-col items-center transition-all duration-300
            ${
              !collapsed ? "translate-x-0 opacity-100" : ""
            }
          `}
        >
          {/* 对话气泡 */}
          {showBubble && (
            <div className="mb-2 w-52 p-2 rounded-xl bg-white/60 text-black shadow-lg text-sm text-center relative animate-fadeIn">
              {currentMessages[index]}
              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white/90 rotate-45 shadow-md"></div>
            </div>
          )}

          {/* 角色图片 */}
          <div
            className="w-30 h-30 cursor-pointer"
            onClick={handleClick}
          >
            <Image
              src="/images/Q.png"
              alt="assistant"
              width={100}
              height={100}
              style={{ objectFit: "contain" }}
              className="transition-transform duration-300 hover:scale-110 hover:-translate-y-1"
            />
          </div>

          {/* 折叠按钮 (X) */}
          <button
            onClick={() => setCollapsed(true)}
            className="bg-pink-200 hover:bg-pink-300 border px-2 py-2 mr-3 border-white text-black orther-button mt-1" 
          >
            <X size={10} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}