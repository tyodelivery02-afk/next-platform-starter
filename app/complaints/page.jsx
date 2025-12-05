"use client";

import { useState, useEffect, useRef } from "react";
import AlertModal from "components/alert";
import WarningModal from "components/warning";
import LoadingModal from "components/loading";
import ConfirmModal from "components/confirm";
import { Minus, Plus } from "phosphor-react";
import { Pie } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { categories } from 'app/config/config';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

export default function ComplaintPage() {
    const alertRef = useRef();
    const warningRef = useRef();
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Loading...");
    const [counts, setCounts] = useState({});
    const [chartPeriod, setChartPeriod] = useState("today");
    const [chartData, setChartData] = useState({});
    const [historyData, setHistoryData] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchStartDate, setSearchStartDate] = useState("");
    const [searchEndDate, setSearchEndDate] = useState("");

    useEffect(() => {
        fetchTodayData();
        fetchChartData("today");
        fetchHistory(1);
    }, []);

    const fetchTodayData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/complaints/today");
            if (!res.ok) throw new Error("データ取得失敗");
            const result = await res.json();

            const initialCounts = {};
            categories.forEach(cat => {
                initialCounts[cat] = result.data[cat] || 0;
            });
            setCounts(initialCounts);
        } catch (err) {
            console.error(err);
            warningRef.current?.open({ message: "データの取得に失敗しました" });
        } finally {
            setLoading(false);
        }
    };

    const fetchChartData = async (period) => {
        try {
            const res = await fetch(`/api/complaints/stats?period=${period}`);
            if (!res.ok) throw new Error("統計データ取得失敗");
            const result = await res.json();
            setChartData(result.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchHistory = async (page, startDate = "", endDate = "") => {
        setLoading(true);
        setLoadingMessage("Loading...");
        try {
            let url = `/api/complaints/history?page=${page}`;
            if (startDate && endDate) {
                url += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
            } else if (startDate) {
                url += `&startDate=${encodeURIComponent(startDate)}`;
            } else if (endDate) {
                url += `&endDate=${encodeURIComponent(endDate)}`;
            }

            const res = await fetch(url);
            if (!res.ok) throw new Error("履歴データ取得失敗");
            const result = await res.json();

            setHistoryData(result.data);
            setTotalPages(result.totalPages);
            setCurrentPage(result.currentPage);
        } catch (err) {
            console.error(err);
            warningRef.current?.open({ message: "履歴データの取得に失敗しました" });
        } finally {
            setLoading(false);
        }
    };

    const handleIncrement = (category) => {
        setCounts(prev => ({
            ...prev,
            [category]: (prev[category] || 0) + 1
        }));
    };

    const handleDecrement = (category) => {
        setCounts(prev => ({
            ...prev,
            [category]: Math.max(0, (prev[category] || 0) - 1)
        }));
    };

    const handleInputChange = (category, value) => {
        const numValue = value.replace(/[^0-9]/g, '');
        const parsedValue = numValue === '' ? 0 : parseInt(numValue);

        setCounts(prev => ({
            ...prev,
            [category]: Math.max(0, parsedValue)
        }));
    };

    const handleSave = async () => {
        setLoadingMessage("Executing...");
        setLoading(true);

        try {
            const today = new Date().toISOString().split("T")[0];
            const records = categories.map(cat => ({
                date: today,
                category: cat,
                count: counts[cat] || 0
            }));

            const res = await fetch("/api/complaints/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(records)
            });

            if (!res.ok) {
                alertRef.current?.open({ message: "保存失敗！" });
            } else {
                alertRef.current?.open({ message: "保存成功！" });
                await fetchChartData(chartPeriod);
                await fetchHistory(currentPage, searchStartDate, searchEndDate);
            }
        } catch (err) {
            console.error(err);
            alertRef.current?.open({ message: "保存失敗！" });
        } finally {
            setLoading(false);
        }
    };

    const handlePeriodChange = (period) => {
        setChartPeriod(period);
        fetchChartData(period);
    };

    const handleSearch = () => {
        if (searchStartDate || searchEndDate) {
            fetchHistory(1, searchStartDate, searchEndDate);
        } else {
            fetchHistory(1);
        }
    };

    const handlePageChange = (page) => {
        fetchHistory(page, searchStartDate, searchEndDate);
    };

    const getChartDataForPeriod = () => {
        const data = chartPeriod === "today" ? counts : chartData;
        const labels = [];
        const values = [];
        const colors = [];

        categories.forEach((cat, index) => {
            const value = data[cat] || 0;
            if (value > 0) {
                labels.push(cat);
                values.push(value);
                colors.push(`hsl(${(index * 360) / categories.length}, 70%, 60%)`);
            }
        });

        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    };

    const chartOptions = {
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true
            },
            datalabels: {
                color: '#000',
                font: {
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value, context) => {
                    const label = context.chart.data.labels[context.dataIndex];
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return `${label}\n${value}件(${percentage}%)`;
                },
                anchor: 'end',
                align: 'end',
                offset: 8,
                clip: false,
                textAlign: 'center'
            }
        },
        layout: {
            padding: {
                top: 50,
                bottom: 50,
                left: 60,
                right: 60
            }
        },
        maintainAspectRatio: true,
        aspectRatio: 1.2
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
        <div className="bg-style">
            <div className="flex justify-between items-center mb-6">
                <h2 className="relative text-x2 font-bold text-black text-shadow">
                    メール＆トレロ
                </h2>
            </div>

            <div
                className="w-full h-6 my-6"
                style={{
                    backgroundImage: "url(/images/divider.svg)",
                    backgroundRepeat: "repeat-x",
                    backgroundSize: "auto 35%",
                }}
            ></div>

            <div className="mb-8 rounded-xl p-6">

                <div className="overflow-y-auto mb-6" style={{ maxHeight: 'calc(3 * 60px)' }}>
                    <div className="grid grid-cols-7 gap-2">
                        {categories.map(cat => (
                            <div key={cat} className="bg-yellow-50 border rounded-lg p-2 shadow-md hover:shadow-yellow-400 hover:bg-yellow-100 transition-all duration-300">
                                <div className="grid grid-cols-[1fr_24px_36px_24px] items-center gap-1">
                                    <span
                                        className="text-sm truncate min-w-0 mr-1"
                                        title={cat}
                                    >
                                        {cat}
                                    </span>
                                    <button
                                        onClick={() => handleDecrement(cat)}
                                        className="minus-button"
                                    >
                                        <Minus size={16} weight="bold" />
                                    </button>
                                    <input
                                        type="text"
                                        value={counts[cat] || 0}
                                        onChange={(e) => handleInputChange(cat, e.target.value)}
                                        className="w-8 text-center inputfile-item text-sm p-0.5"
                                    />
                                    <button
                                        onClick={() => handleIncrement(cat)}
                                        className="plus-button"
                                    >
                                        <Plus size={16} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <ConfirmModal
                        onConfirm={handleSave}
                        buttonText="保存"
                        message="保存しますか？"
                        buttonColor="save-button"
                    />
                </div>
            </div>

            <div className="mb-8 rounded-xl p-6">
                <div className="flex justify-end items-center mb-4">
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handlePeriodChange("today")}
                            className={`px-4 py-2 rounded ${chartPeriod === "today"
                                ? "bg-sky-400 text-white"
                                : "orther-button"
                                }`}
                        >
                            本日
                        </button>
                        <button
                            onClick={() => handlePeriodChange("month")}
                            className={`px-4 py-2 rounded ${chartPeriod === "month"
                                ? "bg-sky-400 text-white"
                                : "orther-button"
                                }`}
                        >
                            最近1ヶ月
                        </button>
                        <button
                            onClick={() => handlePeriodChange("year")}
                            className={`px-4 py-2 rounded ${chartPeriod === "year"
                                ? "bg-sky-400 text-white"
                                : "orther-button"
                                }`}
                        >
                            最近1年
                        </button>
                    </div>
                </div>

                <div className="w-full" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <Pie data={getChartDataForPeriod()} options={chartOptions} />
                </div>
            </div>
            <hr className="line-item" />

            <div className="mt-6 mb-2">
                <h3 className="text-lg font-semibold mb-4">履歴</h3>

                <div className="flex gap-4 mb-4">
                    <input
                        type="date"
                        value={searchStartDate}
                        onChange={(e) => setSearchStartDate(e.target.value)}
                        className="border rounded p-2"
                    />
                    <input
                        type="date"
                        value={searchEndDate}
                        onChange={(e) => setSearchEndDate(e.target.value)}
                        className="border rounded p-2"
                    />
                    <button
                        onClick={handleSearch}
                        className="orther-button"
                    >
                        検索
                    </button>
                </div>

                <div className="space-y-3">
                    {Object.keys(historyData).length === 0 ? (
                        <div className="p-4">履歴なし</div>
                    ) : (
                        Object.keys(historyData)
                            .sort((a, b) => new Date(b) - new Date(a))
                            .map(date => (
                                <details key={date} className="table-details">
                                    <summary className="table-details-content text-lg">
                                        {formatDate(date)}
                                    </summary>
                                    <div className="p-3">
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="p-2 table-title">分類</th>
                                                        <th className="p-2 table-title">件数</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {historyData[date].map((record, index) => (
                                                        <tr key={index} className="table-hover">
                                                            <td className="border p-2">
                                                                {record.category}
                                                            </td>
                                                            <td className="border p-2 font-semibold">
                                                                {record.count}
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

                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                        >
                            前へ
                        </button>
                        <span className="px-4 py-2">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                        >
                            次へ
                        </button>
                    </div>
                )}
            </div>

            <AlertModal ref={alertRef} />
            <WarningModal ref={warningRef} />
            <LoadingModal show={loading} message={loadingMessage} />
        </div>
    );
}