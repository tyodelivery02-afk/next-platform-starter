"use client";

import { useState, useEffect, useRef } from "react";
import { trolleyList, personList } from "app/config/config";
import ConfirmModal from "components/confirm";
import AlertModal from "components/alert";
import WarningModal from "components/warning";

export default function TrolleyStatusPage() {
    const alertRef = useRef();
    const warningRef = useRef();
    const timeSlots = ["朝", "夜"];
    const statusOptions = ["", "戻", "出"];

    const [data, setData] = useState(timeSlots.map(() => trolleyList.map(() => "")));
    const [updaters, setUpdaters] = useState(timeSlots.map(() => ""));
    const [latestStatus, setLatestStatus] = useState({});
    const [recentRecords, setRecentRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formattedDate, setFormattedDate] = useState("");

    // 统一获取所有数据
    useEffect(() => {
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

                // 并行请求所有API
                const [latestRes, todayRes, recentRes] = await Promise.all([
                    fetch("/api/momotrolley/selectlatest"),
                    fetch("/api/momotrolley/selecttoday"),
                    fetch("/api/momotrolley/select7days")
                ]);

                if (!latestRes.ok || !todayRes.ok || !recentRes.ok) {
                    throw new Error("データ取得失敗");
                }

                const [latestData, todayData, recentData] = await Promise.all([
                    latestRes.json(),
                    todayRes.json(),
                    recentRes.json()
                ]);

                // 设置最新状态
                setLatestStatus(latestData);

                // 设置当天数据
                const newData = timeSlots.map((slot) => {
                    const am_pm = slot === "朝" ? 2 : 1;
                    return trolleyList.map((id) => {
                        const statusCode = todayData.data[am_pm]?.[id] || 0;
                        return statusCode === 1 ? "戻" : statusCode === 2 ? "出" : "";
                    });
                });
                setData(newData);

                // 从 todayData.updaters 中提取更新者
                const newUpdaters = timeSlots.map((slot) => {
                    const am_pm = slot === "朝" ? 2 : 1;
                    return todayData.updaters?.[am_pm] || "";
                });
                setUpdaters(newUpdaters);

                // 设置最近7天记录
                setRecentRecords(recentData.data || []);
            } catch (err) {
                console.error("データ取得エラー:", err);
                // 降级处理：使用客户端时间
                const today = new Date();
                setFormattedDate(today.toISOString().split("T")[0]);
                warningRef.current?.open({ message: "データの取得に失敗しました" });
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, []);

    const handleChange = (rowIndex, colIndex, value) => {
        const trolleyId = trolleyList[colIndex];
        const currentLatestStatus = latestStatus[trolleyId];

        // 检查朝和夜的数据情况
        const morningHasData = data[0].some(status => status !== ""); // 朝这一行是否有数据
        const nightHasData = data[1].some(status => status !== ""); // 夜这一行是否有数据

        // 确定应该在哪一行进行检查
        let shouldCheckThisRow = false;

        if (morningHasData && !nightHasData) {
            // 朝有数据，夜没有数据 → 只在夜这一行检查
            shouldCheckThisRow = (rowIndex === 1);
        } else if (!morningHasData && !nightHasData) {
            // 朝和夜都没有数据 → 只在朝这一行检查
            shouldCheckThisRow = (rowIndex === 0);
        } else {
            // 其他情况（夜有数据或朝夜都有数据）→ 都检查
            shouldCheckThisRow = true;
        }

        // 新增：第二行(夜)需要检查第一行(朝)对应位置是否有数据
        if (rowIndex === 1 && data[0][colIndex] === "") {
            warningRef.current?.open({ message: `朝の桃${trolleyId}号車の状態が未入力です。先に朝のデータを入力してください` });
            return;
        }

        // 只在需要检查的行执行状态验证
        if (shouldCheckThisRow) {
            if (value === "出" && currentLatestStatus === 2) {
                warningRef.current?.open({ message: `桃${trolleyId}号車は既に出庫状態です。重複出庫できません` });
                return;
            }

            if (value === "戻" && currentLatestStatus === 1) {
                warningRef.current?.open({ message: `桃${trolleyId}号車は既に在庫状態です。重複返却できません` });
                return;
            }
        }

        const newData = [...data];
        newData[rowIndex][colIndex] = value;
        setData(newData);
    };

    const handleUpdaterChange = (rowIndex, value) => {
        const newUpdaters = [...updaters];
        newUpdaters[rowIndex] = value;
        setUpdaters(newUpdaters);
    };

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
                data[rowIndex][colIndex] === "戻" ? 1 :
                    data[rowIndex][colIndex] === "出" ? 2 : 0,
            updater,
        }));

        try {
            const res = await fetch("/api/momotrolley/insert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(records),
            });

            if (!res.ok) { alertRef.current?.open({ message: "保存失敗！" }); } else {

                alertRef.current?.open({ message: "保存成功！" });
            }

            // 刷新所有数据
            const [latestRes, recentRes, todayRes] = await Promise.all([
                fetch("/api/momotrolley/selectlatest"),
                fetch("/api/momotrolley/select7days"),
                fetch("/api/momotrolley/selecttoday")
            ]);

            if (latestRes.ok && recentRes.ok && todayRes.ok) {
                const [latestData, recentData, todayData] = await Promise.all([
                    latestRes.json(),
                    recentRes.json(),
                    todayRes.json()
                ]);
                setLatestStatus(latestData);
                setRecentRecords(recentData.data || []);

                // 更新当天数据
                const newData = timeSlots.map((slot) => {
                    const am_pm = slot === "朝" ? 2 : 1;
                    return trolleyList.map((id) => {
                        const statusCode = todayData.data[am_pm]?.[id] || 0;
                        return statusCode === 1 ? "戻" : statusCode === 2 ? "出" : "";
                    });
                });
                setData(newData);

                // 更新更新者（从 todayData.updaters 获取）
                const newUpdaters = timeSlots.map((slot) => {
                    const am_pm = slot === "朝" ? 2 : 1;
                    return todayData.updaters?.[am_pm] || "";
                });
                setUpdaters(newUpdaters);
            }
        } catch (err) {
            console.error(err);
            alertRef.current?.open({ message: "保存失敗！" });
        }
    };

    const getStatusText = (status) => {
        if (status === 1) return "在庫";
        if (status === 2) return "出庫";
        return "未知";
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const getAmPmText = (am_pm) => {
        return am_pm === 2 ? "朝" : "夜";
    };

    const getStatusShortText = (status) => {
        return status === 1 ? "戻" : status === 2 ? "出" : "-";
    };

    // 按日期分组记录
    const groupedRecords = recentRecords.reduce((acc, record) => {
        const dateKey = record.date;
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(record);
        return acc;
    }, {});

    // 获取排序后的日期列表（从新到旧）
    const sortedDates = Object.keys(groupedRecords).sort((a, b) => new Date(b) - new Date(a));

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-400 to-gray-900">
                <div className="text-white text-xl">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="p-8 bg-gray-50 min-h-screen text-gray-800 bg-gradient-to-b from-gray-400 to-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="relative text-x2 font-bold text-black">桃カゴ車チェック</h2>
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

            {/* === 最新状态表 === */}
            <div className="items-center space-x-2 mb-4">
                <h3 className="text-lg font-semibold mb-2 text-center text-white">
                    現状
                </h3>
                <table className="table-itam text-center">
                    <thead>
                        <tr>
                            {trolleyList.map((id) => (
                                <th key={id} className="border border-white p-2 bg-gray-600 text-white">
                                    <span className="text-pink-400">NO.</span>
                                    <span className="text-pink-400 ml-1">{id}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {trolleyList.map((id) => (
                                <td key={id} className={`border p-2 font-bold ${latestStatus[id] === 2
                                    ? 'bg-orange-100 hover:bg-orange-200'
                                    : latestStatus[id] === 1
                                        ? 'bg-blue-100 hover:bg-blue-200'
                                        : ''
                                    }`}>
                                    {getStatusText(latestStatus[id])}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* === 登録用表格 === */}
            <div className="mb-8">
                <table className="table-itam text-center">
                    <thead>
                        <tr>
                            <th className="border p-2 bg-gray-600 text-white">時間帯</th>
                            {trolleyList.map((id) => (
                                <th key={id} className="border border-white p-2 bg-gray-600">
                                    <span className="text-pink-400">NO.</span>
                                    <span className="text-pink-400 ml-1">{id}</span>
                                </th>
                            ))}
                            <th className="border p-2 bg-gray-600 text-white">更新者</th>
                            <th className="border p-2 bg-gray-600 text-white"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((slot, rowIndex) => (
                            <tr key={slot}>
                                <td className="border p-2 font-bold hover:bg-blue-50">{slot}</td>
                                {trolleyList.map((id, colIndex) => (
                                    <td key={id} className="border p-2 hover:bg-blue-50">
                                        <select
                                            value={data[rowIndex][colIndex]}
                                            onChange={(e) =>
                                                handleChange(rowIndex, colIndex, e.target.value)
                                            }
                                            className={`border rounded-lg p-1 
                                                ${data[rowIndex][colIndex] === `戻`
                                                    ? `text-blue-500 hover:bg-red-50`
                                                    : data[rowIndex][colIndex] === `出`
                                                        ? `text-red-500 hover:bg-red-50`
                                                        : data[rowIndex][colIndex] === ``
                                                            ? `hover:bg-red-50` : ``}`}
                                        >
                                            {statusOptions.map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                ))}
                                <td className="border p-2 hover:bg-blue-50">
                                    <select
                                        value={updaters[rowIndex]}
                                        onChange={(e) => handleUpdaterChange(rowIndex, e.target.value)}
                                        className="border text-black rounded-lg p-1 hover:bg-red-50"
                                    >
                                        <option value="">選択</option>
                                        {personList.map((u) => (
                                            <option key={u} value={u}>
                                                {u}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="border p-2 hover:bg-blue-50">
                                    <ConfirmModal
                                        onConfirm={() => handleSubmitRow(rowIndex)}
                                        buttonText="保存"
                                        message="保存しますか"
                                        buttonColor="save-button"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* === 最近7天记录表 === */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2 text-center text-white">
                    最近7日間の記録
                </h3>
                <div className="space-y-3">
                    {sortedDates.length === 0 ? (
                        <div className="text-center text-white p-4">
                            データがありません
                        </div>
                    ) : (
                        sortedDates.map((date) => (
                            <details key={date} className="bg-white/80 rounded-xl shadow-lg">
                                <summary className="cursor-pointer p-3 font-semibold text-lg hover:bg-white rounded-xl transition-colors">
                                    {formattedDate}
                                </summary>
                                <div className="p-3">
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-gray-300 rounded-xl border-0 text-center bg-white rounded-lg">
                                            <thead>
                                                <tr>
                                                    <th className="border p-2 bg-gray-600 text-white">時間</th>
                                                    <th className="border p-2 bg-gray-600 text-white">桃カゴID</th>
                                                    <th className="border p-2 bg-gray-600 text-white">状態</th>
                                                    <th className="border p-2 bg-gray-600 text-white">更新者</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupedRecords[date].map((record, index) => (
                                                    <tr key={index} className="hover:bg-gray-100">
                                                        <td className="border p-2">
                                                            {getAmPmText(record.am_pm)}
                                                        </td>
                                                        <td className="border p-2 font-semibold">
                                                            {record.trolley_id}
                                                        </td>
                                                        <td className="border p-2">
                                                            <span className={`px-2 py-1 rounded ${record.status === 1
                                                                ? 'bg-green-200 text-green-800'
                                                                : 'bg-red-200 text-red-800'
                                                                }`}>
                                                                {getStatusShortText(record.status)}
                                                            </span>
                                                        </td>
                                                        <td className="border p-2">
                                                            {record.updater || "-"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </details>
                        ))
                    )}
                </div>
            </div>
            <AlertModal ref={alertRef} />
            <WarningModal ref={warningRef} />
        </div>
    );
}
