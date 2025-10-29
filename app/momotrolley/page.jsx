"use client";

import { useState, useEffect } from "react";
import { trolleyList, personList } from "app/config/config";

export default function TrolleyStatusPage() {
    const timeSlots = ["朝", "夜"]; // 时间段
    const statusOptions = ["", "戻", "出"]; // 状态选项

    // 登录用状态表格
    const [data, setData] = useState(timeSlots.map(() => trolleyList.map(() => "")));
    const [updaters, setUpdaters] = useState(timeSlots.map(() => ""));
    // 最新状态
    const [latestStatus, setLatestStatus] = useState({}); // { trolley_id: status }

    // 初始化时从DB取最新数据
    useEffect(() => {
        const fetchLatest = async () => {
            try {
                const res = await fetch("/api/momotrolley/selectlatest");
                if (!res.ok) throw new Error("データ取得失敗");
                const result = await res.json();
                setLatestStatus(result);
            } catch (err) {
                console.error("最新データ取得エラー:", err);
            }
        };

        const fetchToday = async () => {
            try {
                const res = await fetch("/api/momotrolley/selecttoday");
                if (!res.ok) throw new Error("今日データ取得失敗");
                const result = await res.json();
                const todayData = result.data; // { 1: {...}, 2: {...} }

                // 初始表格结构填充
                const newData = timeSlots.map((slot, rowIndex) =>
                    trolleyList.map((id) => {
                        const am_pm = slot === "朝" ? 2 : 1;
                        const statusCode = todayData[am_pm]?.[id] || 0;
                        return statusCode === 1 ? "戻" : statusCode === 2 ? "出" : "";
                    })
                );
                setData(newData);
            } catch (err) {
                console.error("当日データ取得エラー:", err);
            }
        };

        fetchLatest();
        fetchToday();
    }, []);

    // 变更状态
    const handleChange = (rowIndex, colIndex, value) => {
        const newData = [...data];
        newData[rowIndex][colIndex] = value;
        setData(newData);
    };

    // 变更updater
    const handleUpdaterChange = (rowIndex, value) => {
        const newUpdaters = [...updaters];
        newUpdaters[rowIndex] = value;
        setUpdaters(newUpdaters);
    };

    // 登录（只提交当前行）
    const handleSubmitRow = async (rowIndex) => {
        const slot = timeSlots[rowIndex];
        const am_pm = slot === "朝" ? 2 : 1;
        const updater = updaters[rowIndex];

        if (!updater) {
            alert("更新者を選択してください。");
            return;
        }

        const records = trolleyList.map((id, colIndex) => ({
            date: new Date().toISOString().split("T")[0],
            trolley_id: id,
            am_pm,
            status:
                data[rowIndex][colIndex] === "戻"
                    ? 1
                    : data[rowIndex][colIndex] === "出"
                        ? 2
                        : 0,
            updater,
        }));

        try {
            const res = await fetch("/api/momotrolley/insert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(records),
            });

            if (!res.ok) throw new Error("登録失敗");
            alert(`${slot}のデータが登録されました！`);
        } catch (err) {
            alert("登録に失敗しました: " + err.message);
        }
    };

    // 转换status为文字
    const getStatusText = (status) => {
        if (status === 1) return "在庫";
        if (status === 2) return "出庫";
        return "未知";
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen text-gray-800 bg-gradient-to-b from-gray-400 to-gray-900">
            <h1 className="text-xl font-bold mb-6 text-center">
                桃かご車チェック
            </h1>

            {/* === 最新状态表 === */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2 text-center">
                    
                </h2>
                <table className="w-full border border-gray-300 text-center bg-white/90 rounded-xl shadow-lg">
                    <thead>
                        <tr>
                            {trolleyList.map((id) => (
                                <th key={id} className="border p-2 bg-green-400 text-white">
                                    {id}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {trolleyList.map((id) => (
                                <td key={id} className="border p-2 font-semibold">
                                    {getStatusText(latestStatus[id])}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* === 登録用表格 === */}
            <table className="w-full border border-gray-300 text-center bg-white/90 rounded-xl shadow-lg">
                <thead>
                    <tr>
                        <th className="border p-2 bg-red-300 text-white">時間帯</th>
                        {trolleyList.map((id) => (
                            <th key={id} className="border p-2 bg-red-300 text-white">
                                {id}
                            </th>
                        ))}
                        <th className="border p-2 bg-red-300 text-white">更新者</th>
                        <th className="border p-2 bg-red-300 text-white">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {timeSlots.map((slot, rowIndex) => (
                        <tr key={slot}>
                            <td className="border p-2 font-bold">{slot}</td>
                            {trolleyList.map((id, colIndex) => (
                                <td key={id} className="border p-2">
                                    <select
                                        value={data[rowIndex][colIndex]}
                                        onChange={(e) =>
                                            handleChange(rowIndex, colIndex, e.target.value)
                                        }
                                        className="border text-red-600 rounded-lg p-1"
                                    >
                                        {statusOptions.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            ))}

                            {/* 更新者选择 */}
                            <td className="border p-2">
                                <select
                                    value={updaters[rowIndex]}
                                    onChange={(e) => handleUpdaterChange(rowIndex, e.target.value)}
                                    className="border text-blue-600 rounded-lg p-1"
                                >
                                    <option value="">選択</option>
                                    {personList.map((u) => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                </select>
                            </td>

                            {/* 登录按钮 */}
                            <td className="border p-2">
                                <button
                                    onClick={() => handleSubmitRow(rowIndex)}
                                    className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    保存
                                </button>
                                            {/* <div className="relative flex gap-2">
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
                                            </div> */}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
