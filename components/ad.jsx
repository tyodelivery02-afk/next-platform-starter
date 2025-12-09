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
    // 路径变化时，如果处于折叠状态，通常应该展开，除非你希望它保持折叠
    // setCollapsed(false); // 这一行根据产品需求可以添加或不加
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
      {/* ✅ 改进点 1: 折叠后的小图标 (单独处理，不包含在主内容区域内)
        它始终位于最外层容器的右下角，因此不会被主内容区域的 CSS 转换影响。
      */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center
                     hover:scale-105 transition active:scale-95"
        >
          <Image
            src="/images/girl.svg"
            alt="open"
            width={32}
            height={32}
            style={{ objectFit: "contain" }}
          />
        </button>
      )}

      {/* 主内容区域 (角色、气泡、关闭按钮) 
        
        改进点 2: 
        当 `collapsed` 为 true 时，使用 `hidden` 类 (Tailwind CSS) 
        或者设置 `pointer-events-none` 配合 `opacity-0` 来完全禁用交互。
        
        由于你使用了过渡效果，我推荐使用 `pointer-events-none` 配合 `opacity-0` 
        和 `max-height: 0` (如果组件高度可变)。
        
        你原来的 `translate-x-[200%] opacity-0` 已经能在视觉上隐藏并**大致**消除交互，
        但如果气泡很大，它的边界可能还会影响页面。
        
        为了确保不占空间和不影响交互，我们增加一个条件渲染：
      */}
      {!collapsed && (
        <div
          className={`
            flex flex-col items-center transition-all duration-300
            ${
              // 保持原有的过渡效果，但只在未折叠状态下渲染此 div
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
              src="/images/girl.svg"
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