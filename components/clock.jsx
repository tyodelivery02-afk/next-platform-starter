"use client";
import { useState, useEffect } from "react";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";

export default function TimeClock() {
  const [value, setValue] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setValue(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <Clock
        value={value}
        renderNumbers={false}
        hourHandWidth={3}
        minuteHandWidth={2}
        secondHandWidth={1}
        size={80}
      />
      <div className="text-black font-serif mt-4 text-xl tracking-wider">
        {value.toLocaleDateString("ja-JP", {
          month: "2-digit",
        })}
        {value.toLocaleDateString("ja-JP", {
          day: "2-digit",
        })}
      </div>
    </div>
  );
}
