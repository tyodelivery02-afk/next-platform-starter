"use client";
import React, { useState, useEffect, useRef } from "react";
import ConfirmModal from "components/confirm";
import AlertModal from "components/alert";
import { taskList, personList } from 'app/config/config';

export default function TaskCheckSheet() {

  const alertRef = useRef();

  const [tasks, setTasks] = useState(taskList.map((t) => ({ ...t, person: "" })));
  const [history, setHistory] = useState([]);
  const [formattedDate, setFormattedDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // 获取服务器日期
  const fetchServerDate = async () => {
    try {
      const res = await fetch("/api/servertime");
      if (!res.ok) throw new Error("Failed to fetch server time");
      const data = await res.json();
      const today = new Date(data.serverTime);
      setFormattedDate(today.toISOString().split("T")[0]); // YYYY-MM-DD
    } catch (err) {
      console.error(err);
      const today = new Date();
      setFormattedDate(today.toISOString().split("T")[0]);
    }
  };

  // 使用 GET_BY_DATE 获取当天任务
  const fetchTodayTasks = async () => {
    if (!formattedDate) return;
    try {
      const res = await fetch(`/api/taskCheckSheet/todaytask?date=${formattedDate}`);
      if (!res.ok) throw new Error("Failed to fetch today's tasks");
      const todayRecord = await res.json();

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
    } catch (err) {
      console.error("Error fetching today's tasks:", err);
      setTasks(taskList.map((t) => ({ ...t, person: "" })));
    }
  };

  // 拉取历史记录
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/taskCheckSheet/dailytask");
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setHistory([]);
    }
  };

  useEffect(() => {
    fetchServerDate();
  }, []);

  // 当获取到日期后，再拉取当天任务和历史记录
  useEffect(() => {
    if (formattedDate) {
      fetchTodayTasks();
      fetchHistory();
    }
  }, [formattedDate]);

  // 保存
  const handleSave = async () => {
    if (!formattedDate) return;
    try {
      const res = await fetch("/api/taskCheckSheet/dailytask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formattedDate, data: tasks }),
      });
      if (res.ok) alertRef.current?.open({ message: "保存成功！" });
      else alertRef.current?.open({ message: "保存失敗！" });
      fetchTodayTasks();
      fetchHistory();
    } catch (err) {
      console.error(err);
      alertRef.current?.open({ message: "保存失敗！" });
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

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-800 bg-gradient-to-b from-gray-400 to-gray-900">
      {/* <FallingImages numImages={50} /> */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="relative text-x2 font-bold text-black">一日のタスク担当者チェックシート</h2>
        <span className="relative text-x1 font-bold text-black">{formattedDate}</span>
      </div>
      <div
        className="w-full h-6 my-6"
        style={{
          backgroundImage: "url(/images/divider.svg)",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 35%",
        }}
      ></div>

      <div className="grid grid-cols-2 gap-6">
        {/* 今日のタスク */}
        <div className="relative rounded-2xl shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-black">今日のタスク</h2>
            <div className="relative flex gap-2">
              <ConfirmModal
                onConfirm={handleClear}
                buttonText="CLEAR"
                message="クリアしますか"
                buttonColor="bg-gray-400 hover:bg-gray-500"
              />
              <ConfirmModal
                onConfirm={handleSave}
                buttonText="保存"
                message="保存しますか"
                buttonColor="bg-blue-500 hover:bg-blue-600"
              />
            </div>
          </div>
          <table className="w-full text-gray-800 bg-white/80 backdrop-blur-md rounded-xl border-0 border-collapse text-sm shadow-sm">
            <thead>
              <tr className="bg-gray-600 text-left text-white rounded-xl">
                <th className="border border-gray-300 px-3 py-2 w-20">時間帯</th>
                <th className="border border-gray-300 px-3 py-2 w-64">業務</th>
                <th className="border border-gray-300 px-3 py-2 w-24">担当者</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => (
                <tr key={idx} className="hover:bg-blue-50">
                  <td className="border px-3 py-2">{task.time}</td>
                  <td className="border px-3 py-2">{task.job}</td>
                  <td className="border px-3 py-2">
                    <select
                      className={`w-full p-2 border rounded ${task.person === "" ? "bg-yellow-50" : "bg-gray-100"
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
        <div className="rounded-2xl shadow p-4 backdrop-blur-sm">
          <h2 className="text-xl font-bold mb-4 text-black">履歴</h2>
          <div className="space-y-3">
            {paginatedHistory.length > 0 ? (
              paginatedHistory.map((record, i) => (
                <details key={i} className="border rounded-lg rounded-xl">
                  <summary className="bg-gray-200 px-4 py-2 cursor-pointer rounded-xl border-0 hover:bg-blue-50">
                    {(() => {
                      const d = new Date(record.date);
                      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(
                        2,
                        "0"
                      )}/${String(d.getDate()).padStart(2, "0")}`;
                    })()}
                  </summary>
                  <div className="p-3 text-sm">
                    <table className="w-full text-gray-800 bg-white/80 backdrop-blur-md rounded-2xl border-0 border-collapse text-sm shadow-sm">
                      <thead>
                        <tr className="bg-gray-600 text-left text-white">
                          <th className="border px-2 py-1 w-20">時間帯</th>
                          <th className="border px-2 py-1">業務</th>
                          <th className="border px-2 py-1 w-24">担当者</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(record.daily_task) &&
                          record.daily_task.map((task, j) => (
                            <tr className="hover:bg-blue-50" key={j}>
                              <td className="border px-2 py-1">{task.time}</td>
                              <td className="border px-2 py-1">{task.job}</td>
                              <td className="border px-2 py-1">{task.person}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))
            ) : (
              <p className="text-sm text-gray-500">記録なし</p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-blue-50"
              >
                前のページ
              </button>

              <div className="flex items-center gap-1 text-white">
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPageInput}
                  onChange={(e) => setCurrentPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      let val = Number(currentPageInput);
                      if (isNaN(val) || val < 1) val = 1;
                      if (val > totalPages) val = totalPages;
                      setCurrentPage(val);
                      setCurrentPageInput(String(val));
                      e.target.blur();
                    }
                  }}
                  onBlur={() => {
                    let val = Number(currentPageInput);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > totalPages) val = totalPages;
                    setCurrentPage(val);
                    setCurrentPageInput(String(val));
                  }}
                  className="w-14 text-center text-white rounded px-1 py-0.5 outline-none border border-gray-300"
                />
                <span>/ {totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-blue-50"
              >
                次のページ
              </button>
            </div>
          )}
        </div>
      </div>
      <AlertModal ref={alertRef} />
    </div>
  );
}
