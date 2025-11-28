"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Calendar, CheckSquare, Pen, Headset, PersonSimpleWalk, CurrencyJpy, Cat, List, X, } from "phosphor-react";
import TimeClock from "components/clock";
import Image from 'next/image';

{/* 主菜单按钮 */ }
const navItems = [
  { icon: <House size={28} />, href: "/", label: `HOME` },
  { icon: <CheckSquare size={28} />, href: "/taskCheckSheet", label: `TASK` },
  { icon: <Calendar size={28} />, href: "/fcstmaker", label: `FCST作成` },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 256 256">
        <path d="M88,224a16,16,0,1,1-16-16A16,16,0,0,1,88,224Zm128-16a16,16,0,1,0,16,16A16,16,0,0,0,216,208Zm24-32H56V75.31A15.86,15.86,0,0,0,51.31,64L29.66,42.34A8,8,0,0,0,18.34,53.66L40,75.31V176H32a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16Z"></path>
      </svg>
    ),
    href: "/momotrolley",
    label: `桃カゴ`,
  },
  { icon: <Pen size={28} />, href: "/fcatwrite", label: `FCST記入` },
  { icon: <Headset size={28} />, href: "/customer", label: `メール` },
  { icon: <CurrencyJpy size={28} />, href: "/compensation", label: `賠償` },
  { icon: <PersonSimpleWalk size={28} />, href: "/fuzaihyou", label: `不在票管理` },
  { icon: <Cat size={28} />, href: "/yamatocsv", label: `ヤマト予定確定データ` },
];

{/* 顶部菜单按钮 */ }
const menuIcons = [
  {
    icon: "/images/japan-map.svg",
    href: "/population",
    label: "地図",
  },
  //  {
  //   icon: "/images/dictionary.svg",
  //   href: "/dictionary",
  //   label: "辞書",
  // }, {
  //   icon: "/images/constellation.svg",
  //   href: "/uranai",
  //   label: "運勢",
  // },
];


export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);

  // 页面切换时自动关闭菜单
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // 防止背景滚动
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  return (
    <>
      {/* 固定右上角按钮 */}
      <div className="fixed top-4 right-4 z-[60]">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className={`p-3 rounded-full shadow-lg transition-all duration-300 ${menuOpen
            ? "bg-yellow-200 text-gray-800 hover:bg-yellow-300 rotate-90"
            : "bg-sky-600 text-white hover:bg-sky-700"
            }`}
        >
          {menuOpen ? <X size={30} /> : <List size={30} />}
        </button>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 顶部栏 */}
      <div
        className={`fixed top-0 right-0 h-screen w-1/3 bg-sky-100 shadow-2xl z-50 transform transition-transform duration-500 ease-out
    ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center px-6 py-4 border-b border-gray-300 bg-sky-200">
          {/* 左侧：TimeClock */}
          <TimeClock />

          {/* 右侧：頂部菜单 */}
          <div className="ml-6 flex-1">
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  {menuIcons.map((item, idx) => (
                    <td key={idx} className="text-center p-2">
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="relative flex justify-center items-center w-16 h-16 rounded-xl transition-transform duration-300 hover:scale-[1.01] hover:translate-x-1 hover:-translate-x-1"
                      >
                        {/* 图标 */}
                        <Image
                          src={item.icon}
                          width={60}
                          height={60}
                          alt={item.label}
                          className="opacity-95 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-transform duration-300"
                        />

                        {/* 文字 */}
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 text-lg font-medium text-black bg-sky-200 rounded-xl transition-opacity duration-300 hover:opacity-100">
                          {item.label}
                        </span>
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* 主菜单 */}
        <div className="h-[calc(100vh-64px)] overflow-y-auto">
          <ul className="p-6 flex flex-col gap-3">
            {navItems.map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <li key={index}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`group flex items-center px-4 py-3 rounded-lg no-underline
                      ${isActive ? "bg-yellow-300 text-black" : "text-black hover:bg-yellow-200"}
                      transition-all duration-300 overflow-hidden`}
                  >
                    <div className="flex items-center gap-2 text-lg font-medium">
                      <span>{item.label}</span>
                      <span className="opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        {item.icon}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
