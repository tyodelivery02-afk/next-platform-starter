"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { hidePaths,messages } from "app/config/config";

export function FloatingCharacter() {
  const pathname = usePathname();
  const [showBubble, setShowBubble] = useState(false);
  const [index, setIndex] = useState(0);

  const currentMessages = messages[pathname] || ["がんばろう！"];

  useEffect(() => {
    setIndex(0);
    setShowBubble(true);
  }, [pathname]);

  const handleClick = () => {
    setIndex((prev) => (prev + 1) % currentMessages.length);
  };

const shouldHide = hidePaths.includes(pathname);

if (shouldHide) {
  return <div style={{ display: "none" }} />;
}

  return (
    <div className="fixed bottom-8 right-1 z-50 flex flex-col items-center">
      {showBubble && (
        <div className="mb-2 w-52 p-2 rounded-xl bg-white/60 text-black shadow-lg text-sm text-center relative animate-fadeIn">
          {currentMessages[index]}
          <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white/90 rotate-45 shadow-md"></div>
        </div>
      )}

      <div className="w-30 h-30 cursor-pointer" onClick={handleClick}>
        <Image
          src="/images/girl.svg"
          alt="assistant"
          width={100}
          height={100}
          style={{ objectFit: "contain" }}
          className="transition-transform duration-300 hover:scale-110 hover:-translate-y-1"
        />
      </div>
    </div>
  );
}
