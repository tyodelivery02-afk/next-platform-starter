"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function FloatingCharacter() {
  const pathname = usePathname();
  const [showBubble, setShowBubble] = useState(false);
  const [index, setIndex] = useState(0);

  const messages = {
    "/login": [
      "パスワード教えないー",
    ],
    "/": [
      "こんにちは！ホームページへようこそ！",
      "今日もいい天気ですね！",
      "ฅ^•ω•^ฅ にゃーにゃー",
    ],
    "/taskCheckSheet": [
      "今日のタスクを確認してみましょう！",
      "「担当者」に自分の名前を入力してください！",
      "最後に「保存」ボタンをクリックして保存します！",
    ],
    "/fcatmaker": [
      "FCSTを作成してみましょう！",
      "まずは「マスタ抽出」にFCSTをインポート！",
      "次にマスタ番号で集計データを取得します！",
      "取得した集計データを「集計」にインポート！",
      "最後に対象FCSTを選んで「FCST作成」をクリック！",
      "できました！おつかれさま〜 (*ˊᗜˋ*)",
    ],
  };

  const currentMessages = messages[pathname] || ["がんばろう！"];

  // 进入页面或切换路径时自动显示第一句
  useEffect(() => {
    setIndex(0);          // 第一条
    setShowBubble(true);  // 自动显示气泡
  }, [pathname]);

  const handleClick = () => {
    // 点击切换下一句
    setIndex((prev) => (prev + 1) % currentMessages.length);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center">
      {/* 对话气泡 */}
      {showBubble && (
        <div className="mb-2 w-64 p-2 rounded-xl bg-white/90 text-gray-800 shadow-lg text-sm text-center relative animate-fadeIn">
          {currentMessages[index]}
          <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white/90 rotate-45 shadow-md"></div>
        </div>
      )}

      {/* 卡通人物 */}
      <div className="w-30 h-30 cursor-pointer" onClick={handleClick}>
        <Image
          src="/images/ghostpumpkin.gif"
          alt="キャラクター"
          width={150}
          height={150}
          style={{ objectFit: "contain" }}
          className="move-animation"
        />
      </div>
    </div>
  );
}
