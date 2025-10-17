"use client";
import React, { useState } from "react";

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

  const personList = ["杜", "郭", "藤", "三浦", "村田", "ススミタ", "ビカス", "村崎", "華", "末安", "中野"]; // 人员列表
  const [tasks, setTasks] = useState(
    taskList.map((task) => ({ ...task, person: "" }))
  );

  const handlePersonChange = (index, newPerson) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], person: newPerson };
    setTasks(updatedTasks);
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-800">
      <div className="flex justify-between items-center mb-6 w-250 mx-auto">
        <h1 className="text-xl font-bold">
          一日のタスク担当者チェックシート
        </h1>
        <span className="text-sm text-gray-600">{formattedDate}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 justify-items-center">
        <div className="bg-white rounded-2xl shadow p-4 w-250 mx-auto">
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
                  <td className="border border-gray-200 px-3 py-2">{task.time}</td>
                  <td className="border border-gray-200 px-3 py-2">{task.job}</td>
                  <td className="border border-gray-200 px-3 py-2">
                    <select
                      className="w-full p-2 border border-gray-300 rounded"
                      value={task.person}
                      onChange={(e) => handlePersonChange(idx, e.target.value)}
                    >
                      <option value=""></option>
                      {personList.map((person) => (
                        <option key={person} value={person}>
                          {person}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}