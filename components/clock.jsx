"use client";
import { useState, useEffect } from "react";

export default function TimeClock() {
  const [value, setValue] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setValue(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-orange-400 text-shadow font-semibold font-serif mt-4 text-xl tracking-wider div-hover">
        {value.toLocaleDateString("ja-JP", {
          month: "2-digit",
          day: "2-digit",
        })}
      </div>
      <div className="text-orange-400 text-shadow font-semibold font-serif text-2xl tracking-wider inline-block min-w-[120px] text-center div-hover">
        {value.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })}
      </div>
    </div>
  );
}