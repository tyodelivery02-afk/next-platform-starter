// FallingImages.jsx
"use client";

import { useState } from "react";

const imageUrls = [
  "/images/halloween-ghost.svg",
  "/images/halloween-witch.svg",
  "/images/halloween-skeleton.svg",
  "/images/halloween-pumpkin.svg",
  "/images/halloween-typical.svg",
  "/images/halloween-winged.svg",
];

function FallingImages({ numImages = 70 }) {
  const [images] = useState(() =>
    Array.from({ length: numImages }).map(() => ({
      url: imageUrls[Math.floor(Math.random() * imageUrls.length)],
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
          alt=""
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

export default FallingImages;