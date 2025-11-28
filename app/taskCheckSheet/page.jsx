"use client";
import React, { useState, useEffect, useRef } from "react";
import ConfirmModal from "components/confirm";
import AlertModal from "components/alert";
import { taskList, personList } from 'app/config/config';
import LoadingModal from "components/loading";
import WarningModal from "components/warning";

export default function TaskCheckSheet() {
  const alertRef = useRef();

  const [tasks, setTasks] = useState(taskList.map((t) => ({ ...t, person: "" })));
  const [history, setHistory] = useState([]);
  const [formattedDate, setFormattedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  const warningRef = useRef();

  // 并行获取所有数据
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 先获取服务器时间
      const timeRes = await fetch("/api/servertime");
      if (!timeRes.ok) throw new Error("Failed to fetch server time");
      const timeData = await timeRes.json();
      const today = new Date(timeData.serverTime);
      const dateStr = today.toISOString().split("T")[0];
      setFormattedDate(dateStr);

      // 并行获取当天任务和历史记录
      const [todayRes, historyRes] = await Promise.all([
        fetch(`/api/taskCheckSheet/todaytask?date=${dateStr}`),
        fetch("/api/taskCheckSheet/dailytask")
      ]);

      // 处理当天任务
      if (todayRes.ok) {
        const todayRecord = await todayRes.json();
        if (todayRecord && Array.isArray(todayRecord.daily_task)) {
          const updatedTasks = taskList.map((t) => {
            const dbTask = todayRecord.daily_task.find(
              (d) => d.time === t.time && d.job === t.job
            );
            return { ...t, person: dbTask ? dbTask.person : "" };
          });
          setTasks(updatedTasks);
        } else {
          setTasks(taskList.map((t) => ({ ...t, person: "" })));
        }
      } else {
        setTasks(taskList.map((t) => ({ ...t, person: "" })));
      }

      // 处理历史记录
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(Array.isArray(historyData) ? historyData : []);
        setCurrentPage(1);
      } else {
        setHistory([]);
      }

    } catch (err) {
      console.error("Error fetching data:", err);
      // 降级处理：使用客户端时间
      const today = new Date();
      setFormattedDate(today.toISOString().split("T")[0]);
      setTasks(taskList.map((t) => ({ ...t, person: "" })));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // 初始化时获取所有数据
  useEffect(() => {
    fetchAllData();
  }, []);

  // 保存
  const handleSave = async () => {
    if (!formattedDate) {
      warningRef.current?.open({ message: "日付が取得できていません" });
      return;
    }
    setLoadingMessage("Executing...");
    setLoading(true);
    try {
      const res = await fetch("/api/taskCheckSheet/dailytask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formattedDate, data: tasks }),
      });

      if (res.ok) {
        alertRef.current?.open({ message: "保存成功！" });

        // 保存成功后刷新数据
        const [todayRes, historyRes] = await Promise.all([
          fetch(`/api/taskCheckSheet/todaytask?date=${formattedDate}`),
          fetch("/api/taskCheckSheet/dailytask")
        ]);

        if (todayRes.ok) {
          const todayRecord = await todayRes.json();
          if (todayRecord && Array.isArray(todayRecord.daily_task)) {
            const updatedTasks = taskList.map((t) => {
              const dbTask = todayRecord.daily_task.find(
                (d) => d.time === t.time && d.job === t.job
              );
              return { ...t, person: dbTask ? dbTask.person : "" };
            });
            setTasks(updatedTasks);
          }
        }

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory(Array.isArray(historyData) ? historyData : []);
        }
      } else {
        alertRef.current?.open({ message: "保存失敗！" });
      }
    } catch (err) {
      console.error(err);
      alertRef.current?.open({ message: "保存失敗！" });
    } finally {
      setLoading(false);
    }
  };

  // 清空担当者
  const handleClear = () => {
    setTasks(tasks.map((t) => ({ ...t, person: "" })));
  };

  const handlePersonChange = (index, value) => {
    const updated = [...tasks];
    updated[index].person = value;
    setTasks(updated);
  };

  const totalPages = Math.ceil(history.length / itemsPerPage);
  const paginatedHistory = history.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const [currentPageInput, setCurrentPageInput] = useState(String(currentPage));

  useEffect(() => {
    setCurrentPageInput(String(currentPage));
  }, [currentPage]);

  // 格式化日期显示
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="bg-style">
      <div className="flex justify-between items-center mb-6">
        <h2 className="relative text-x2 font-bold text-black text-shadow">
          一日のタスク担当者チェックシート
        </h2>
      </div>

      <div
        className="w-full h-6 my-6"
        style={{
          backgroundImage: "url(/images/divider.svg)",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 35%",
          opacity: 0.8,
        }}
      />

      <div className="grid grid-cols-2 gap-6">
        {/* 今日のタスク */}
        <div className="table-div">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-sky-800">今日のタスク</h2>
            <div className="flex gap-2">
              <ConfirmModal
                onConfirm={handleClear}
                buttonText="CLEAR"
                message="クリアしますか"
                buttonColor="clear-button"
              />
              <ConfirmModal
                onConfirm={handleSave}
                buttonText="保存"
                message="保存しますか"
                buttonColor="save-button"
              />
            </div>
          </div>

          <table className="w-full border-collapse text-black">
            <thead>
              <tr className="table-title rounded-xl text-left">
                <th className="border border-sky-300 px-3 py-2 w-20">時間帯</th>
                <th className="border border-sky-300 px-3 py-2 w-64">業務</th>
                <th className="border border-sky-300 px-3 py-2 w-24">担当者</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => (
                <tr
                  key={idx}
                  className="table-hover"
                >
                  <td className="border border-white px-3 py-2">{task.time}</td>
                  <td className="border border-white px-3 py-2">{task.job}</td>
                  <td className="border border-white px-3 py-2">
                    <select
                      className={`w-full p-2 border rounded transition-colors duration-300 ${task.person === ""
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-sky-50 border-sky-200"
                        }`}
                      value={task.person}
                      onChange={(e) => handlePersonChange(idx, e.target.value)}
                    >
                      <option value=""></option>
                      {personList.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 履歴 */}
        <div className="table-div">
          <h2 className="text-xl font-bold mb-4 text-black">履歴</h2>
          <div className="space-y-3">
            {paginatedHistory.length > 0 ? (
              paginatedHistory.map((record, i) => (
                <details
                  key={i}
                  className="table-details"
                >
                  <summary className="table-details-content">
                    {formatDate(record.date)}
                  </summary>
                  <div className="p-3 text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-sky-600 text-left text-white">
                          <th className="border border-sky-300 px-2 py-1 w-20">
                            時間帯
                          </th>
                          <th className="border border-sky-300 px-2 py-1">業務</th>
                          <th className="border border-sky-300 px-2 py-1 w-24">
                            担当者
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.daily_task?.map((task, j) => (
                          <tr
                            key={j}
                            className="hover:bg-yellow-200 transition-colors"
                          >
                            <td className="border border-sky-100 px-2 py-1">
                              {task.time}
                            </td>
                            <td className="border border-sky-100 px-2 py-1">
                              {task.job}
                            </td>
                            <td className="border border-sky-100 px-2 py-1">
                              {task.person}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))
            ) : (
              <p className="text-sm text-sky-800">記録なし</p>
            )}
          </div>
        </div>
      </div>
      <AlertModal ref={alertRef} />
      <WarningModal ref={warningRef} />
      <LoadingModal show={loading} message={loadingMessage} />
    </div>
  );
}