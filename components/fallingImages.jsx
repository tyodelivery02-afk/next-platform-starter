// FallingImages.jsx
"use client";

import { useState } from "react";
import Image from "next/image";

//ハロウィン仕様
// const imageUrls = [
//   "/images/halloween-ghost.svg",
//   "/images/halloween-witch.svg",
//   "/images/halloween-skeleton.svg",
//   "/images/halloween-pumpkin.svg",
//   "/images/halloween-typical.svg",
//   "/images/halloween-winged.svg",
// ];

//クリスマス仕様
const imageUrls = [
  "/images/snow1.svg",
  "/images/snow2.svg",
  "/images/snow3.svg",
  "/images/snow4.svg",
  "/images/snow5.svg",
  "/images/snow6.svg",
  "/images/snow7.svg",
  "/images/snow8.svg",
];

function FallingImages({ numImages = 70 }) {
  const [images] = useState(() =>
    Array.from({ length: numImages }).map(() => ({
      url: imageUrls[Math.floor(Math.random() * imageUrls.length)],
      left: Math.random() * 100,
      size: 20 + Math.random() * 40,
      duration: 5 + Math.random() * 10,
      delay: Math.random() * 5,
      color: ["#ffffffff", "#f4a7b9", "#ffb6c1", "#ff69b4", "#87cefa", "#a3e4d7"][
        Math.floor(Math.random() * 5)
      ],
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {images.map((img, idx) => (
        <div
          key={idx}
          className="absolute"
          style={{
            left: `${img.left}%`,
            width: `${img.size}px`,
            height: `${img.size}px`,
            animation: `fall ${img.duration}s linear ${img.delay}s infinite`,
          }}
        >
          {/* 颜色着色层 */}
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: img.color,
              maskImage: `url(${img.url})`,
              WebkitMaskImage: `url(${img.url})`,
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
          />
        </div>
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

export default FallingImages;