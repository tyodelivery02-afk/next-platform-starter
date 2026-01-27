"use client";

import { useState, useEffect, useRef } from "react";
import ConfirmModal from "components/confirm";
import AlertModal from "components/alert";
import WarningModal from "components/warning";
import LoadingModal from "components/loading";

export default function ForecastInputPage() {
    const alertRef = useRef();
    const warningRef = useRef();

    // 当前日期数据（自动使用今天）
    const [currentDate, setCurrentDate] = useState("");
    const [forecastData, setForecastData] = useState({
        cainiao_kix_tokyo_forecast: 0,
        cainiao_kix_osaka_forecast: 0,
        cainiao_kix_tokyo_actual: 0,
        cainiao_kix_osaka_actual: 0,
        cn_center: 0,
        trolley_count: 0,
        box_count: 0,
        box_unit: 0,
        delivery_count: 0
    });

    // 历史记录
    const [historyRecords, setHistoryRecords] = useState([]);
    const [searchStartDate, setSearchStartDate] = useState("");
    const [searchEndDate, setSearchEndDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Loading...");

    // 偏差分析数据
    const [deviationAnalysis, setDeviationAnalysis] = useState({
        tokyo_deviation: 0,
        osaka_deviation: 0,
        total_deviation: 0,
        deviation_rate: 0
    });

    const recordsPerPage = 20;

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        setCurrentDate(today);
        loadTodayData(today);
        loadHistoryData();
    }, []);

    const loadTodayData = async (date) => {
        setLoading(true);
        setLoadingMessage("Loading...");
        try {
            const forecastRes = await fetch(`/api/fcatwrite?date=${date}`);

            if (forecastRes.ok) {
                const forecastResult = await forecastRes.json();
                if (forecastResult.data && forecastResult.data.length > 0) {
                    setForecastData(forecastResult.data[0]);
                    calculateDeviation(forecastResult.data[0]);
                } else {
                    // 如果没有数据，重置为默认值
                    const defaultData = {
                        cainiao_kix_tokyo_forecast: 0,
                        cainiao_kix_osaka_forecast: 0,
                        cainiao_kix_tokyo_actual: 0,
                        cainiao_kix_osaka_actual: 0,
                        cn_center: 0,
                        trolley_count: 0,
                        box_count: 0,
                        box_unit: 0,
                        delivery_count: 0
                    };
                    setForecastData(defaultData);
                    calculateDeviation(defaultData);
                }
            }
        } catch (error) {
            console.error("データ読み込みエラー:", error);
            warningRef.current?.open({ message: "データの読み込みに失敗しました" });
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryData = async (page = 1, startDate = "", endDate = "") => {
        setLoading(true);
        setLoadingMessage("Loading...");
        try {
            const offset = (page - 1) * recordsPerPage;
            let url = `/api/fcatwrite?limit=${recordsPerPage}&offset=${offset}`;

            if (startDate && endDate) {
                url = `/api/fcatwrite?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=${recordsPerPage}&offset=${offset}`;
            } else if (startDate) {
                url = `/api/fcatwrite?startDate=${encodeURIComponent(startDate)}&limit=${recordsPerPage}&offset=${offset}`;
            } else if (endDate) {
                url = `/api/fcatwrite?endDate=${encodeURIComponent(endDate)}&limit=${recordsPerPage}&offset=${offset}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                const result = await res.json();
                setHistoryRecords(result.data || []);
                setTotalRecords(result.total || 0);
                setCurrentPage(page);
            }
        } catch (error) {
            console.error("履歴読み込みエラー:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchDate = () => {
        if (searchStartDate || searchEndDate) {
            loadHistoryData(1, searchStartDate, searchEndDate);
        } else {
            loadHistoryData(1);
        }
    };

    const handlePageChange = (newPage) => {
        loadHistoryData(newPage, searchStartDate, searchEndDate);
    };

    const calculateDeviation = (data) => {
        const tokyoForecast = Number(data.cainiao_kix_tokyo_forecast) || 0;
        const osakaForecast = Number(data.cainiao_kix_osaka_forecast) || 0;
        const tokyoActual = Number(data.cainiao_kix_tokyo_actual) || 0;
        const osakaActual = Number(data.cainiao_kix_osaka_actual) || 0;

        const tokyoDev = tokyoActual - tokyoForecast;
        const osakaDev = osakaActual - osakaForecast;
        const totalDev = tokyoDev + osakaDev;
        const totalForecast = tokyoForecast + osakaForecast;
        const devRate = totalForecast > 0 ? ((totalDev / totalForecast) * 100).toFixed(1) : 0;

        setDeviationAnalysis({
            tokyo_deviation: tokyoDev,
            osaka_deviation: osakaDev,
            total_deviation: totalDev,
            deviation_rate: devRate
        });
    };

    const handleForecastChange = (field, value) => {
        const newData = { ...forecastData, [field]: value };
        setForecastData(newData);
        calculateDeviation(newData);
    };

    const handleSaveForecast = async () => {
        setLoading(true);
        setLoadingMessage("Executing...");
        try {
            const res = await fetch("/api/fcatwrite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: currentDate, ...forecastData })
            });

            if (res.ok) {
                alertRef.current?.open({ message: "保存成功！" });
                loadHistoryData(currentPage, searchStartDate, searchEndDate);
            } else {
                alertRef.current?.open({ message: "保存失敗！" });
            }
        } catch (error) {
            console.error(error);
            alertRef.current?.open({ message: "保存失敗！" });
        } finally {
            setLoading(false);
        }
    };

    const handleClearForecast = () => {
        setForecastData({
            cainiao_kix_tokyo_forecast: 0,
            cainiao_kix_osaka_forecast: 0,
            cainiao_kix_tokyo_actual: 0,
            cainiao_kix_osaka_actual: 0,
            cn_center: 0,
            trolley_count: 0,
            box_count: 0,
            box_unit: 0,
            delivery_count: 0
        });
        setDeviationAnalysis({
            tokyo_deviation: 0,
            osaka_deviation: 0,
            total_deviation: 0,
            deviation_rate: 0
        });
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    };

    const formatDateWithDay = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    };

    const totalPages = Math.ceil(totalRecords / recordsPerPage);

    return (
        <div className="bg-style">
            <div className="flex justify-between items-center mb-6">
                <h2 className="relative text-x2 font-bold text-black text-shadow">フォーキャスト入力</h2>
            </div>

            {/* 件数入力欄 */}
            <div className="mb-4">
                <div className="overflow-x-auto">
                    <table className="table-div">
                        <thead>
                            <tr>
                                <th className="table-title p-3" rowSpan="3" style={{ minWidth: "150px" }}>日付</th>
                                <th className="table-title p-3" colSpan="4">関空E棟</th>
                                <th className="table-title p-3" rowSpan="2">新木場</th>
                                <th className="table-title p-3" colSpan="4">新木場横持</th>
                            </tr>
                            <tr>
                                <th className="table-title p-3" colSpan="2">FORECAST</th>
                                <th className="table-title p-3" colSpan="2">実績値</th>
                                <th className="table-title p-3" rowSpan="2">横持個数</th>
                                <th className="table-title p-3" rowSpan="2">BOX数</th>
                                <th className="table-title p-3" rowSpan="2">箱数</th>
                                <th className="table-title p-3" rowSpan="2">佐川出し数量</th>
                            </tr>
                            <tr>
                                <th className="table-title p-3">CAINIAO-KIX<br />東京分</th>
                                <th className="table-title p-3">CAINIAO-KIX<br />大阪分</th>
                                <th className="table-title p-3">CAINIAO-KIX<br />東京分</th>
                                <th className="table-title p-3">CAINIAO-KIX<br />大阪分</th>
                                <th className="table-title p-3">CN-CENTER</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border p-4 font-semibold text-lg">
                                    {formatDateWithDay(currentDate)}
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.cainiao_kix_tokyo_forecast}
                                        onChange={(e) => handleForecastChange('cainiao_kix_tokyo_forecast', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.cainiao_kix_osaka_forecast}
                                        onChange={(e) => handleForecastChange('cainiao_kix_osaka_forecast', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.cainiao_kix_tokyo_actual}
                                        onChange={(e) => handleForecastChange('cainiao_kix_tokyo_actual', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.cainiao_kix_osaka_actual}
                                        onChange={(e) => handleForecastChange('cainiao_kix_osaka_actual', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.cn_center}
                                        onChange={(e) => handleForecastChange('cn_center', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.trolley_count}
                                        onChange={(e) => handleForecastChange('trolley_count', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.box_count}
                                        onChange={(e) => handleForecastChange('box_count', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.box_unit}
                                        onChange={(e) => handleForecastChange('box_unit', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                                <td className="border p-3">
                                    <input
                                        type="number"
                                        value={forecastData.delivery_count}
                                        onChange={(e) => handleForecastChange('delivery_count', e.target.value)}
                                        className="w-full px-3 py-2 input-item"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={handleClearForecast} className="clear-button">
                        クリア
                    </button>
                    <ConfirmModal
                        onConfirm={handleSaveForecast}
                        buttonText="保存"
                        message="保存しますか？"
                        buttonColor="save-button"
                    />
                </div>
            </div>

            {/* 偏差分析 */}
            <div className="mb-8">
                <div className="flex gap-3">
                    <div className="text-center p-2 rounded-lg shadow bg-yellow-50 hover:bg-yellow-100 hover:scale-[1.03] transition-all duration-300" style={{ width: "180px" }}>
                        <div className="text-sm text-black mb-1">東京偏差</div>
                        <div className={`text-xl font-bold ${deviationAnalysis.tokyo_deviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {deviationAnalysis.tokyo_deviation >= 0 ? '+' : ''}{deviationAnalysis.tokyo_deviation}個
                        </div>
                    </div>
                    <div className="text-center p-2 rounded-lg shadow bg-yellow-50 hover:bg-yellow-100 hover:scale-[1.03] transition-all duration-300" style={{ width: "180px" }}>
                        <div className="text-sm text-black mb-1">大阪偏差</div>
                        <div className={`text-xl font-bold ${deviationAnalysis.osaka_deviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {deviationAnalysis.osaka_deviation >= 0 ? '+' : ''}{deviationAnalysis.osaka_deviation}個
                        </div>
                    </div>
                    <div className="text-center p-2 rounded-lg shadow bg-yellow-50 hover:bg-yellow-100 hover:scale-[1.03] transition-all duration-300" style={{ width: "180px" }}>
                        <div className="text-sm text-black mb-1">合計偏差</div>
                        <div className={`text-xl font-bold ${deviationAnalysis.total_deviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {deviationAnalysis.total_deviation >= 0 ? '+' : ''}{deviationAnalysis.total_deviation}個
                        </div>
                    </div>
                    <div className="text-center p-2 rounded-lg shadow bg-yellow-50 hover:bg-yellow-100 hover:scale-[1.03] transition-all duration-300" style={{ width: "180px" }}>
                        <div className="text-sm text-black mb-1">偏差率</div>
                        <div className={`text-xl font-bold ${Math.abs(deviationAnalysis.deviation_rate) <= 5 ? 'text-green-600' : 'text-orange-600'}`}>
                            {deviationAnalysis.deviation_rate >= 0 ? '+' : ''}{deviationAnalysis.deviation_rate}%
                        </div>
                    </div>
                </div>
            </div>
            <hr className="line-item" />

            {/* 過去記録 */}
            <div className="mt-6 mb-2">
                <h2 className="text-lg font-semibold mb-2">
                    履歴
                </h2>
                <div className="space-y-3">
                    {/* 日付範囲検索 */}
                    <div className="mb-4 flex gap-2 items-center flex-wrap">
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={searchStartDate}
                                onChange={(e) => setSearchStartDate(e.target.value)}
                                className="border rounded-lg px-4 py-2"
                            />
                        </div>
                        <span className="text-lg">〜</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={searchEndDate}
                                onChange={(e) => setSearchEndDate(e.target.value)}
                                className="border rounded-lg px-4 py-2"
                            />
                        </div>
                        <button onClick={handleSearchDate} className="orther-button">
                            検索
                        </button>
                    </div>

                    {/* 記録一覧 */}
                    <div className="space-y-3">
                        {historyRecords.length === 0 ? (
                            <div className="p-4">履歴なし</div>
                        ) : (
                            historyRecords.map((record) => {
                                const tokyoForecast = Number(record.cainiao_kix_tokyo_forecast) || 0;
                                const osakaForecast = Number(record.cainiao_kix_osaka_forecast) || 0;
                                const tokyoActual = Number(record.cainiao_kix_tokyo_actual) || 0;
                                const osakaActual = Number(record.cainiao_kix_osaka_actual) || 0;
                                const totalForecast = tokyoForecast + osakaForecast;
                                const totalActual = tokyoActual + osakaActual;
                                const deviation = totalActual - totalForecast;
                                const deviationRate = totalForecast > 0 ? ((deviation / totalForecast) * 100).toFixed(1) : 0;

                                return (
                                    <details key={record.id} className="table-details">
                                        <summary className="table-details-content">
                                            {formatDate(record.date)} - 偏差率:
                                            <span className={`ml-2 font-bold ${deviationRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {deviationRate >= 0 ? '+' : ''}{deviationRate}%
                                            </span>
                                        </summary>
                                        <div className="p-3">
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="p-2 table-title">東京予測</th>
                                                            <th className="p-2 table-title">大阪予測</th>
                                                            <th className="p-2 table-title">東京実績</th>
                                                            <th className="p-2 table-title">大阪実績</th>
                                                            <th className="p-2 table-title">CN-CENTER</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="table-hover">
                                                            <td className="border p-2">{record.cainiao_kix_tokyo_forecast}</td>
                                                            <td className="border p-2">{record.cainiao_kix_osaka_forecast}</td>
                                                            <td className="border p-2">{record.cainiao_kix_tokyo_actual}</td>
                                                            <td className="border p-2">{record.cainiao_kix_osaka_actual}</td>
                                                            <td className="border p-2">{record.cn_center}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </details>
                                );
                            })
                        )}
                    </div>

                    {/* 分页 */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-4">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                前へ
                            </button>
                            <span className="px-4">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                次へ
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <AlertModal ref={alertRef} />
            <WarningModal ref={warningRef} />
            <LoadingModal show={loading} message={loadingMessage} />
        </div>
    );
}