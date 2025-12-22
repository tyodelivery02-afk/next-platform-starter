"use client";

import { useState, useEffect, useRef } from "react";
import WarningModal from "components/warning";
import LoadingModal from "components/loading";
import { companies, SPGList } from 'app/config/config';
import { Plus, X } from "phosphor-react";
import { Pie } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

export default function SheetsDisplayPage() {
    const warningRef = useRef();
    const [loading, setLoading] = useState(true);
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);

    // 検索条件
    const [selectedDelivery, setSelectedDelivery] = useState([]);
    const [selectedTanto, setSelectedTanto] = useState([]);
    const [houseNumbers, setHouseNumbers] = useState([""]); // 改为数组
    const [ticketNos, setTicketNos] = useState([""]); // 改为数组
    const [selectedTicketType, setSelectedTicketType] = useState([]);
    const [reasons, setReasons] = useState([""]); // 改为数组
    const [selectedResult, setSelectedResult] = useState(["成立"]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedRecorder, setSelectedRecorder] = useState([]);
    const [tantoInputs, setTantoInputs] = useState([""]); // 新增：担当输入框数组

    // 分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        applyFilters();
        setCurrentPage(1);
    }, [allData, selectedDelivery, selectedTanto, houseNumbers, ticketNos, selectedTicketType, reasons, selectedResult, startDate, endDate, selectedRecorder, tantoInputs]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/sheets/data");
            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error("API配額超限，請稍後再試");
                }
                throw new Error("データ取得失敗");
            }
            const result = await res.json();
            setAllData(result.data || []);

            if (result.cached) {
                console.log("使用缓存数据");
            }
        } catch (err) {
            console.error(err);
            warningRef.current?.open({ message: err.message || "データの取得に失敗しました" });
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...allData];

        // 配送業者フィルタ
        if (selectedDelivery.length > 0) {
            filtered = filtered.filter(item => selectedDelivery.includes(item.配送業者));
        }

        // 担当フィルタ（处理按钮选择和输入框）
        const allTanto = [...selectedTanto];
        tantoInputs.forEach(input => {
            if (input.trim()) {
                const values = input.split(",").map(v => v.trim()).filter(v => v);
                allTanto.push(...values);
            }
        });
        if (allTanto.length > 0) {
            filtered = filtered.filter(item => allTanto.includes(item.担当));
        }

        // HOUSE番号フィルタ（多个输入框）
        const validHouseNumbers = houseNumbers.filter(h => h.trim());
        if (validHouseNumbers.length > 0) {
            filtered = filtered.filter(item =>
                validHouseNumbers.some(h =>
                    item.HOUSE番号.toLowerCase().includes(h.toLowerCase())
                )
            );
        }

        // Ticket Noフィルタ（多个输入框）
        const validTicketNos = ticketNos.filter(t => t.trim());
        if (validTicketNos.length > 0) {
            filtered = filtered.filter(item =>
                validTicketNos.some(t =>
                    item.TicketNo.toLowerCase().includes(t.toLowerCase())
                )
            );
        }

        // Ticketタイプフィルタ
        if (selectedTicketType.length > 0) {
            filtered = filtered.filter(item => {
                const ticket = item.TicketNo;
                return selectedTicketType.some(type => {
                    if (type === "クレーム") {
                        return ticket.startsWith("601");
                    } else if (type === "問合せ") {
                        return ticket.startsWith("602");
                    }
                    return false;
                });
            });
        }

        // 理由フィルタ（多个输入框）
        const validReasons = reasons.filter(r => r.trim());
        if (validReasons.length > 0) {
            filtered = filtered.filter(item =>
                validReasons.some(r =>
                    item.理由.toLowerCase().includes(r.toLowerCase())
                )
            );
        }

        // 結果フィルタ
        if (selectedResult.length > 0) {
            filtered = filtered.filter(item => {
                if (selectedResult.includes("空白")) {
                    return selectedResult.includes(item.結果) || item.結果 === "";
                }
                return selectedResult.includes(item.結果);
            });
        }

        // 記入者フィルタ
        if (selectedRecorder.length > 0) {
            filtered = filtered.filter(item => selectedRecorder.includes(item.記入者));
        }

        // 時間フィルタ
        if (startDate || endDate) {
            filtered = filtered.filter(item => {
                const itemDate = item.記入時間.split(' ')[0];
                const itemDateObj = new Date(itemDate.replace(/\//g, '-'));

                if (startDate && endDate) {
                    return itemDateObj >= new Date(startDate) && itemDateObj <= new Date(endDate);
                } else if (startDate) {
                    return itemDateObj >= new Date(startDate);
                } else if (endDate) {
                    return itemDateObj <= new Date(endDate);
                }
                return true;
            });
        }

        setFilteredData(filtered);
    };

    const toggleSelection = (value, selectedArray, setSelectedArray) => {
        if (selectedArray.includes(value)) {
            setSelectedArray(selectedArray.filter(item => item !== value));
        } else {
            setSelectedArray([...selectedArray, value]);
        }
    };

    // 添加输入框
    const addInput = (array, setArray) => {
        setArray([...array, ""]);
    };

    // 删除输入框
    const removeInput = (array, setArray, index) => {
        if (array.length > 1) {
            const newArray = array.filter((_, i) => i !== index);
            setArray(newArray);
        }
    };

    // 更新输入框值
    const updateInput = (array, setArray, index, value) => {
        const newArray = [...array];
        newArray[index] = value;
        setArray(newArray);
    };

    // 円グラフデータ生成
    const generateChartData = (field, fieldName) => {
        const counts = {};

        filteredData.forEach(item => {
            let value;

            if (field === "TicketType") {
                const ticket = item.TicketNo;
                if (ticket.startsWith("601")) {
                    value = "クレーム";
                } else if (ticket.startsWith("602")) {
                    value = "問合せ";
                } else {
                    value = "その他";
                }
            } else {
                value = item[field] || "空白";
            }

            if (field === "配送業者") {
                counts[value] = (counts[value] || 0) + 1;
            } else if (field === "担当") {
                counts[value] = (counts[value] || 0) + 1;
            } else if (field === "TicketType") {
                counts[value] = (counts[value] || 0) + 1;
            } else if (field === "結果") {
                const displayValue = value === "" ? "空白" : value;
                counts[displayValue] = (counts[displayValue] || 0) + 1;
            } else if (field === "理由") {
                counts[value] = (counts[value] || 0) + 1;
            } else if (field === "記入者") {
                counts[value] = (counts[value] || 0) + 1;
            }
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);
        const colors = labels.map((_, index) =>
            `hsl(${(index * 360) / labels.length}, 70%, 60%)`
        );

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
                display: true,
                position: 'bottom'
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
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return `${value}件\n(${percentage}%)`;
                },
                anchor: 'center',
                align: 'center',
                textAlign: 'center'
            }
        },
        maintainAspectRatio: true,
        aspectRatio: 1.5
    };

    const getUniqueRecorders = () => {
        const recorders = new Set(allData.map(item => item.記入者).filter(r => r));
        return Array.from(recorders);
    };

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageData = filteredData.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    return (
        <div className="bg-style">
            <div className="flex justify-between items-center mb-6">
                <h2 className="relative text-x2 font-bold text-black text-shadow">
                    チケット関連
                </h2>
            </div>

            {/* 検索フォーム */}
            <div className="mb-8 rounded-xl p-6 bg-white shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* 配送業者 */}
                    <div>
                        <label className="block text-sm font-medium mb-2">配送業者</label>
                        <div className="flex gap-2">
                            {companies.map(delivery => (
                                <button
                                    key={delivery}
                                    onClick={() => toggleSelection(delivery, selectedDelivery, setSelectedDelivery)}
                                    className={`px-4 py-2 rounded ${selectedDelivery.includes(delivery)
                                        ? "bg-sky-400 text-white"
                                        : "select-button"
                                        }`}
                                >
                                    {delivery}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 担当 */}
                    <div>
                        <label className="block text-sm font-medium mb-2">担当</label>
                        {selectedDelivery.includes("SPG") && selectedDelivery.length === 1 ? (
                            <div className="grid grid-cols-4 gap-2">
                                {SPGList.map(tanto => (
                                    <button
                                        key={tanto}
                                        onClick={() => toggleSelection(tanto, selectedTanto, setSelectedTanto)}
                                        className={`px-2 py-1 rounded text-sm ${selectedTanto.includes(tanto)
                                            ? "bg-sky-400 text-white"
                                            : "select-button"
                                            }`}
                                    >
                                        {tanto}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {tantoInputs.map((value, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={value}
                                            onChange={(e) => updateInput(tantoInputs, setTantoInputs, index, e.target.value)}
                                            className="inputfile-item flex-1"
                                            placeholder="担当者を入力"
                                        />
                                        {tantoInputs.length > 1 && (
                                            <button
                                                onClick={() => removeInput(tantoInputs, setTantoInputs, index)}
                                                className="minus-button"
                                            >
                                                <X size={20} weight="bold" />
                                            </button>
                                        )}
                                        {index === tantoInputs.length - 1 && (
                                            <button
                                                onClick={() => addInput(tantoInputs, setTantoInputs)}
                                                className="plus-button"
                                            >
                                                <Plus size={20} weight="bold" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* HOUSE番号 */}
                    <div>
                        <label className="block text-sm font-medium mb-2">HOUSE番号</label>
                        <div className="space-y-2">
                            {houseNumbers.map((value, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updateInput(houseNumbers, setHouseNumbers, index, e.target.value)}
                                        className="inputfile-item flex-1"
                                        placeholder="HOUSE番号を入力"
                                    />
                                    {houseNumbers.length > 1 && (
                                        <button
                                            onClick={() => removeInput(houseNumbers, setHouseNumbers, index)}
                                            className="minus-button"
                                        >
                                            <X size={20} weight="bold" />
                                        </button>
                                    )}
                                    {index === houseNumbers.length - 1 && (
                                        <button
                                            onClick={() => addInput(houseNumbers, setHouseNumbers)}
                                            className="plus-button"
                                        >
                                            <Plus size={20} weight="bold" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ticket No */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Ticket No</label>
                        <div className="space-y-2">
                            {ticketNos.map((value, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updateInput(ticketNos, setTicketNos, index, e.target.value)}
                                        className="inputfile-item flex-1"
                                        placeholder="Ticket Noを入力"
                                    />
                                    {ticketNos.length > 1 && (
                                        <button
                                            onClick={() => removeInput(ticketNos, setTicketNos, index)}
                                            className="minus-button"
                                        >
                                            <X size={20} weight="bold" />
                                        </button>
                                    )}
                                    {index === ticketNos.length - 1 && (
                                        <button
                                            onClick={() => addInput(ticketNos, setTicketNos)}
                                            className="plus-button"
                                        >
                                            <Plus size={20} weight="bold" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ticketタイプ */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Ticketタイプ</label>
                        <div className="flex gap-2">
                            {["クレーム", "問合せ"].map(type => (
                                <button
                                    key={type}
                                    onClick={() => toggleSelection(type, selectedTicketType, setSelectedTicketType)}
                                    className={`px-4 py-2 rounded ${selectedTicketType.includes(type)
                                        ? "bg-sky-400 text-white"
                                        : "select-button"
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 理由 */}
                    <div>
                        <label className="block text-sm font-medium mb-2">理由</label>
                        <div className="space-y-2">
                            {reasons.map((value, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updateInput(reasons, setReasons, index, e.target.value)}
                                        className="inputfile-item flex-1"
                                        placeholder="理由を入力"
                                    />
                                    {reasons.length > 1 && (
                                        <button
                                            onClick={() => removeInput(reasons, setReasons, index)}
                                            className="minus-button"
                                        >
                                            <X size={20} weight="bold" />
                                        </button>
                                    )}
                                    {index === reasons.length - 1 && (
                                        <button
                                            onClick={() => addInput(reasons, setReasons)}
                                            className="plus-button"
                                        >
                                            <Plus size={20} weight="bold" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 結果 */}
                    <div>
                        <label className="block text-sm font-medium mb-2">結果</label>
                        <div className="flex gap-2">
                            {["成立", "不成立", "空白"].map(result => (
                                <button
                                    key={result}
                                    onClick={() => toggleSelection(result, selectedResult, setSelectedResult)}
                                    className={`px-4 py-2 rounded ${selectedResult.includes(result)
                                        ? "bg-sky-400 text-white"
                                        : "select-button"
                                        }`}
                                >
                                    {result}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 記入時間 */}
                    <div>
                        <label className="block text-sm font-medium mb-2">記入時間</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="inputfile-item flex-1"
                            />
                            <span className="self-center">〜</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="inputfile-item flex-1"
                            />
                        </div>
                    </div>

                    {/* 記入者 */}
                    <div>
                        <label className="block text-sm font-medium mb-2">記入者</label>
                        <div className="flex flex-wrap gap-2">
                            {getUniqueRecorders().map(recorder => (
                                <button
                                    key={recorder}
                                    onClick={() => toggleSelection(recorder, selectedRecorder, setSelectedRecorder)}
                                    className={`px-3 py-1 rounded text-sm ${selectedRecorder.includes(recorder)
                                        ? "bg-sky-400 text-white"
                                        : "select-button"
                                        }`}
                                >
                                    {recorder}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 検索結果表示 */}
            <div className="mt-6 mb-8 ">
                {filteredData.length === 0 ? (
                    <div className="p-4 bg-white rounded-xl shadow-md text-center">
                        データがありません
                    </div>
                ) : (
                    <>
                        <details className="table-details" open>
                            <summary className="table-details-content text-lg">
                                全{filteredData.length}件のデータ (ページ {currentPage}/{totalPages})
                            </summary>
                            <div className="p-3">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="p-2 table-title whitespace-nowrap">配送業者</th>
                                                <th className="p-2 table-title whitespace-nowrap">担当</th>
                                                <th className="p-2 table-title whitespace-nowrap">HOUSE番号</th>
                                                <th className="p-2 table-title whitespace-nowrap">Ticket No</th>
                                                <th className="p-2 table-title whitespace-nowrap">理由</th>
                                                <th className="p-2 table-title whitespace-nowrap">結果</th>
                                                <th className="p-2 table-title whitespace-nowrap">記入時間</th>
                                                <th className="p-2 table-title whitespace-nowrap">記入者</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentPageData.map((record, index) => (
                                                <tr key={startIndex + index} className="table-hover">
                                                    <td className="border p-2 whitespace-nowrap">{record.配送業者}</td>
                                                    <td className="border p-2 whitespace-nowrap">{record.担当}</td>
                                                    <td className="border p-2 whitespace-nowrap">{record.HOUSE番号}</td>
                                                    <td className="border p-2 whitespace-nowrap">{record.TicketNo}</td>
                                                    <td
                                                        className="border p-2 max-w-[200px] truncate"
                                                        title={record.理由}
                                                    >
                                                        {record.理由}
                                                    </td>
                                                    <td className="border p-2 whitespace-nowrap">{record.結果}</td>
                                                    <td className="border p-2 whitespace-nowrap">{record.記入時間}</td>
                                                    <td className="border p-2 whitespace-nowrap">{record.記入者}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </details>

                        {/* 分页控制 */}
                        {filteredData.length > itemsPerPage && (
                            <div className="flex justify-center gap-2 mt-4">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                                >
                                    前へ
                                </button>

                                <span className="px-4 py-2">
                                    {currentPage} / {totalPages}
                                </span>

                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                                >
                                    次へ
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 円グラフ表示 */}
            {filteredData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedDelivery.length > 0 && (
                        <div className="rounded-xl p-6 bg-white shadow-md">
                            <h4 className="text-center font-semibold mb-4">配送業者</h4>
                            <Pie data={generateChartData("配送業者", "配送業者")} options={chartOptions} />
                        </div>
                    )}

                    {(selectedTanto.length > 0 || tantoInputs.some(t => t.trim())) && (
                        <div className="rounded-xl p-6 bg-white shadow-md">
                            <h4 className="text-center font-semibold mb-4">担当</h4>
                            <Pie data={generateChartData("担当", "担当")} options={chartOptions} />
                        </div>
                    )}

                    {selectedTicketType.length > 0 && (
                        <div className="rounded-xl p-6 bg-white shadow-md">
                            <h4 className="text-center font-semibold mb-4">Ticketタイプ</h4>
                            <Pie data={generateChartData("TicketType", "Ticketタイプ")} options={chartOptions} />
                        </div>
                    )}

                    {reasons.some(r => r.trim()) && (
                        <div className="rounded-xl p-6 bg-white shadow-md">
                            <h4 className="text-center font-semibold mb-4">理由</h4>
                            <Pie data={generateChartData("理由", "理由")} options={chartOptions} />
                        </div>
                    )}

                    {selectedResult.length > 0 && (
                        <div className="rounded-xl p-6 bg-white shadow-md">
                            <h4 className="text-center font-semibold mb-4">結果</h4>
                            <Pie data={generateChartData("結果", "結果")} options={chartOptions} />
                        </div>
                    )}

                    {selectedRecorder.length > 0 && (
                        <div className="rounded-xl p-6 bg-white shadow-md">
                            <h4 className="text-center font-semibold mb-4">記入者</h4>
                            <Pie data={generateChartData("記入者", "記入者")} options={chartOptions} />
                        </div>
                    )}
                </div>
            )}

            <WarningModal ref={warningRef} />
            <LoadingModal show={loading} message="Loading..." />
        </div>
    );
}