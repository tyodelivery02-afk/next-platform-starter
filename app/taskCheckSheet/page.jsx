"use client";
import React, { useState, useEffect, useRef } from "react";
import ConfirmModal from "components/confirm";
import AlertModal from "components/alert";

export default function TaskCheckSheet() {
  const taskList = [
    { time: "8:00", job: "横持ちカゴ確認" },
    { time: "8:30", job: "KPI確認" },
    { time: "9:30", job: "返品確認　午前" },
    { time: "10:00", job: "CST 午前" },
    { time: "10:00", job: "再配達確認　前日分" },
    { time: "10:30", job: "不正ステータス確認" },
    { time: "11:00", job: "サイトユーザー登録住所確認" },
    { time: "12:00", job: "再配達確認　8～12時" },
    { time: "13:00", job: "NC　業者引き渡し" },
    { time: "14:00", job: "配達失敗件数記録" },
    { time: "14:30", job: "日報貨物件数記録" },
    { time: "15:00", job: "返品確認　午後" },
    { time: "15:00", job: "桃太郎件数報告" },
    { time: "16:00", job: "再配達確認　12～16時" },
    { time: "16:30", job: "桃太郎誤仕分確認" },
    { time: "17:00", job: "PG件数報告（社員）" },
    { time: "17:00", job: "翌日分再出荷確認" },
    { time: "17:00", job: "PG集荷漏れ確認" },
    { time: "17:30", job: "保税エリアの許可貨物確認" },
    { time: "17:30", job: "ヤマト貼替データCS送信" },
    { time: "17:30", job: "CST 午後" },
    { time: "17:55", job: "再出荷最終確認" },
    { time: "18:00", job: "現場残貨確認（社員）" },
    { time: "18:00", job: "コールセンター集計（平日テレ）" },
    { time: "19:00", job: "愛陸車両確認（社員）" },
  ];

  const alertRef = useRef();
  const personList = ["郭", "藤", "三浦", "村田", "ススミタ", "ビカス", "村崎", "華", "杜", "末安", "中野"];

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
      const res = await fetch(`/api/todaytask?date=${formattedDate}`);
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
      const res = await fetch("/api/dailytask");
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
      const res = await fetch("/api/dailytask", {
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

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">一日のタスク担当者チェックシート</h1>
        <span>{formattedDate}</span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 今日のタスク */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">今日のタスク</h2>
            <div className="flex gap-2">
              <ConfirmModal
                onConfirm={handleClear}
                buttonText="CLEAR"
                message="クリアするよーーOK？"
                buttonColor="bg-gray-400 hover:bg-gray-500"
              />
              <ConfirmModal
                onConfirm={handleSave}
                buttonText="保存"
                message="保存するよーーOK？"
                buttonColor="bg-blue-500 hover:bg-blue-600"
              />
            </div>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-100 text-left">
                <th className="border border-gray-300 px-3 py-2 w-20">時間帯</th>
                <th className="border border-gray-300 px-3 py-2 w-64">業務</th>
                <th className="border border-gray-300 px-3 py-2 w-24">担当者</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{task.time}</td>
                  <td className="border px-3 py-2">{task.job}</td>
                  <td className="border px-3 py-2">
                    <select
                      className="w-full p-2 border rounded"
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
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-4">履歴</h2>
          <div className="space-y-3">
            {paginatedHistory.length > 0 ? (
              paginatedHistory.map((record, i) => (
                <details key={i} className="border rounded-lg">
                  <summary className="bg-gray-100 px-4 py-2 cursor-pointer">
                    {(() => {
                      const d = new Date(record.date);
                      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(
                        2,
                        "0"
                      )}/${String(d.getDate()).padStart(2, "0")}`;
                    })()}
                  </summary>
                  <div className="p-3 text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-green-50">
                          <th className="border px-2 py-1 w-20">時間帯</th>
                          <th className="border px-2 py-1">業務</th>
                          <th className="border px-2 py-1 w-24">担当者</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(record.daily_task) &&
                          record.daily_task.map((task, j) => (
                            <tr key={j}>
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
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                前のページ
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
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
