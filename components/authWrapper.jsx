"use client";

import { useEffect, useState } from "react";
import LoginPage from "../app/login/page";
import { Header } from "./header";
import { Footer } from "./footer";

export default function AuthWrapper({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // 使用 sessionStorage 来保证关闭标签页即失效
    const token = sessionStorage.getItem("sessionToken");
    if (!token) {
      setChecked(true);
      setIsLoggedIn(false);
      return;
    }

    // 后端验证 token
    fetch(`/api/loginverify?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        setIsLoggedIn(data.loggedIn);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  if (!checked) return null; // 等待验证完成

  if (!isLoggedIn) {
    // 登录页直接显示，不显示 Header/Footer
    return <LoginPage />;
  }

  // 已登录页面显示 Header/Footer
  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-col w-full mx-auto grow">
        <Header />
        <main className="grow">{children}</main>
        {/* <Footer /> */}
      </div>
    </div>
  );
}
