// components/ZipcodeTooltip.jsx
"use client";

import { useEffect, useState, useRef } from "react";
import { X, Download } from "phosphor-react";
import ReactECharts from "echarts-for-react";

export default function ZipcodeTooltip({ areaName, areaCode, position, isVisible, onClose, onMouseEnter, onMouseLeave, housingData }) {
    const [zipcodes, setZipcodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const tooltipRef = useRef(null);
    const [adjustedPos, setAdjustedPos] = useState({ left: 0, top: 0 });
    const TOOLTIP_W = 520;

    const updateTooltipPosition = () => {
        if (!position || !tooltipRef.current) return;

        const GAP = 15;
        const MARGIN = 8;
        const tooltipH = tooltipRef.current.offsetHeight;
        const tooltipW = tooltipRef.current.offsetWidth || TOOLTIP_W;

        let left = position.x + GAP;
        let top = position.y + GAP;

        if (left + tooltipW > window.innerWidth - MARGIN) {
            left = position.x - tooltipW - GAP;
        }
        if (left < MARGIN) left = MARGIN;

        if (top + tooltipH > window.innerHeight - MARGIN) {
            top = position.y - tooltipH - GAP;
        }
        if (top < MARGIN) top = MARGIN;

        setAdjustedPos({ left, top });
    };

    useEffect(() => {
        if (!position || !isVisible) return;

        const frame1 = requestAnimationFrame(() => {
            updateTooltipPosition();

            const frame2 = requestAnimationFrame(() => {
                updateTooltipPosition();
            });
            return () => cancelAnimationFrame(frame2);
        });

        return () => cancelAnimationFrame(frame1);
    }, [position, isVisible, loading, housingData, searchQuery, zipcodes.length]);

    useEffect(() => {
        if (!tooltipRef.current || !position || !isVisible) return;

        const observer = new ResizeObserver(() => {
            updateTooltipPosition();
        });

        observer.observe(tooltipRef.current);

        return () => observer.disconnect();
    }, [position, isVisible, housingData]);

    useEffect(() => {
        console.log('ZipcodeTooltip - areaName:', areaName);
        console.log('ZipcodeTooltip - areaCode:', areaCode);

        if (!areaCode) {
            console.warn('ZipcodeTooltip - Missing areaCode');
            setLoading(false);
            setError('地域情報が不足しています');
            return;
        }

        const fetchZipcodes = async () => {
            setLoading(true);
            setError(null);
            setSearchQuery("");

            try {
                const url = `/api/zipcode?localGovCode=${encodeURIComponent(areaCode)}`;
                console.log('ZipcodeTooltip - Fetching URL:', url);

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`郵便番号の取得に失敗しました (${response.status})`);
                }

                const data = await response.json();
                console.log('ZipcodeTooltip - Response data:', data);

                if (data.success) {
                    setZipcodes(data.zipcodes);
                } else {
                    setError(data.error || "郵便番号の取得に失敗しました");
                }
            } catch (err) {
                console.error("郵便番号取得エラー:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchZipcodes();
    }, [areaName, areaCode]);

    const downloadCSV = () => {
        if (filteredZipcodes.length === 0) return;

        // CSV 头部
        const headers = ['タイプ', '郵便番号', '地域'];

        // CSV 数据行
        const rows = zipcodes.map(zip => {
            const type = zip.flag === 1 ? '住所' : '事務所';
            const town = zip.town || '';
            return [type, zip.zipcode, town,];
        });

        // 组合 CSV 内容
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // 添加 BOM 以支持 Excel 正确显示中文
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

        // 创建下载链接
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${areaName}_郵便番号.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const filteredZipcodes = zipcodes.filter(zip => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            (zip.zipcode && zip.zipcode.toLowerCase().includes(q)) ||
            (zip.town && zip.town.toLowerCase().includes(q))
        );
    });

    if (!position) return null;

    return (
        <div
            ref={tooltipRef}
            className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{
                left: adjustedPos.left,
                top: adjustedPos.top,
                width: 520,
                maxHeight: "90vh",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0px) scale(1)" : "translateY(6px) scale(0.97)",
                transition: "opacity 0.2s ease, transform 0.2s ease",
                pointerEvents: isVisible ? "auto" : "none",
                visibility: position ? "visible" : "hidden",
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* ── ヘッダー ── */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
                <h3 className="font-bold text-lg text-gray-800 truncate pr-2">{areaName}</h3>
                <button onClick={onClose} className="x-button flex-shrink-0">
                    <X size={22} weight="bold" />
                </button>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
                <div className="p-3 border-b border-gray-100 bg-sky-50 flex flex-col gap-2">
                    {/* ── 住宅属性 3層ドーナツ ── */}
                    {housingData ? (() => {
                        const rawHousing = housingData?.housing || null;
                        const chartData = housingData?.chartData || null;

                        const purpose = rawHousing?.purpose || {};
                        const tenure = rawHousing?.tenure || {};
                        const building = rawHousing?.building || {};

                        const innerData = (chartData?.inner || [
                            { name: "専用住宅", value: purpose["専用住宅"] ?? 0 },
                            { name: "店舗その他の併用住宅", value: purpose["店舗その他の併用住宅"] ?? 0 },
                        ]).filter(item => item.value > 0);

                        const middleData = (chartData?.middle || [
                            { name: "持ち家", value: tenure["持ち家"] ?? 0 },
                            { name: "民営借家", value: tenure["民営借家"] ?? 0 },
                            { name: "公営等借家", value: tenure["公営等借家"] ?? 0 },
                        ]).filter(item => item.value > 0);

                        const outerData = (chartData?.outer || [
                            { name: "共同住宅", value: building["共同住宅"] ?? 0 },
                            { name: "一戸建", value: building["一戸建"] ?? 0 },
                            { name: "長屋建・その他", value: building["長屋建・その他"] ?? 0 },
                        ]).filter(item => item.value > 0);

                        const hasHousingChart =
                            innerData.length > 0 ||
                            middleData.length > 0 ||
                            outerData.length > 0;

                        const donutOption = {
                            tooltip: {
                                trigger: "item",
                                formatter: (params) => {
                                    return `${params.seriesName}<br/>${params.name}: ${Number(params.value).toLocaleString()} (${params.percent}%)`;
                                },
                            },
                            legend: {
                                orient: "vertical",
                                right: 8,
                                top: "middle",
                                itemWidth: 12,
                                itemHeight: 12,
                                itemGap: 10,
                                textStyle: {
                                    fontSize: 11,
                                    color: "#374151",
                                },
                            },
                            series: [
                                {
                                    name: "建て方",
                                    type: "pie",
                                    radius: ["48%", "64%"],
                                    center: ["32%", "46%"],
                                    minAngle: 3,
                                    selectedMode: false,
                                    avoidLabelOverlap: true,
                                    itemStyle: {
                                        borderColor: "#fff",
                                        borderWidth: 2,
                                        borderRadius: 4,
                                    },
                                    label: {
                                        show: false,
                                    },
                                    labelLine: {
                                        show: false,
                                    },
                                    data: outerData,
                                },
                                {
                                    name: "権利関係",
                                    type: "pie",
                                    radius: ["28%", "42%"],
                                    center: ["32%", "46%"],
                                    minAngle: 3,
                                    selectedMode: false,
                                    itemStyle: {
                                        borderColor: "#fff",
                                        borderWidth: 2,
                                        borderRadius: 4,
                                    },
                                    label: {
                                        show: false,
                                    },
                                    data: middleData,
                                },
                                {
                                    name: "用途",
                                    type: "pie",
                                    radius: ["10%", "22%"],
                                    center: ["32%", "46%"],
                                    minAngle: 3,
                                    selectedMode: false,
                                    itemStyle: {
                                        borderColor: "#fff",
                                        borderWidth: 2,
                                        borderRadius: 4,
                                    },
                                    label: {
                                        show: false,
                                    },
                                    data: innerData,
                                },
                            ],
                            color: [
                                "#38bdf8", "#7dd3fc",
                                "#4ade80", "#86efac", "#bbf7d0",
                                "#f59e0b", "#fcd34d", "#fef08a",
                            ],
                            graphic: [
                                {
                                    type: "text",
                                    left: "center",
                                    top: "35%",
                                    style: {
                                        textAlign: "center",
                                        fill: "#94a3b8",
                                        fontSize: 12,
                                        fontWeight: 600,
                                    },
                                },
                            ],
                        };

                        return (
                            <details className="table-details">
                                <summary className="table-details-content flex justify-between items-center">
                                    <span>住宅属性</span>
                                </summary>

                                <div className="pt-1 px-1">
                                    <div className="flex justify-center">
                                        {hasHousingChart ? (
                                            <ReactECharts
                                                key={areaCode}
                                                option={donutOption}
                                                style={{ width: "100%", height: 260 }}
                                                notMerge={true}
                                                lazyUpdate={false}
                                            />
                                        ) : (
                                            <div className="w-full h-[180px] flex items-center justify-center text-sm text-gray-400">
                                                住宅データがありません
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </details>
                        );
                    })() : (
                        <div className="px-4 py-3 flex items-center gap-2 text-xs text-gray-400">
                            <div className="w-4 h-4 border-2 border-sky-300 border-t-transparent rounded-full animate-spin" />
                            住宅データ読み込み中...
                        </div>
                    )}

                    {/* ── 郵便番号（折りたたみ） ── */}
                    <details className="table-details" open>
                        <summary className="table-details-content flex justify-between items-center">
                            <span>
                                郵便番号一覧
                                {!loading && !error && filteredZipcodes.length > 0 && (
                                    <span className="ml-2 text-xs font-normal">
                                        <span className="text-gray-500">（</span>
                                        <span className="text-blue-600">
                                            住所{filteredZipcodes.filter(z => z.flag === 1).length}件
                                        </span>
                                        <span className="text-gray-500"> / </span>
                                        <span className="text-green-600">
                                            事務所{filteredZipcodes.filter(z => z.flag === 2).length}件
                                        </span>
                                        <span className="text-gray-500">）</span>
                                    </span>
                                )}
                            </span>
                            <button
                                onClick={(e) => { e.preventDefault(); downloadCSV(); }}
                                disabled={loading || !!error || filteredZipcodes.length === 0}
                                className="floppyDisk-button"
                                title="CSV出力"
                            >
                                <Download size={18} weight="bold" />
                            </button>
                        </summary>

                        <div className="pt-2 px-1">
                            {!loading && !error && zipcodes.length > 0 && (
                                <input
                                    type="text"
                                    placeholder="郵便番号・地域で検索..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full mb-3 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-400"
                                />
                            )}

                            {loading && (
                                <div className="flex items-center justify-center py-6">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                                    <span className="ml-2 text-gray-500 text-sm">loading...</span>
                                </div>
                            )}

                            {error && (
                                <div className="text-red-500 py-3 text-sm">
                                    <p className="font-semibold">エラー</p>
                                    <p>{error}</p>
                                </div>
                            )}

                            {!loading && !error && filteredZipcodes.length === 0 && (
                                <div className="h-72">
                                    <div className="h-full border border-gray-200 rounded-md flex items-center justify-center">
                                        <p className="text-gray-500 text-sm">郵便番号データがありません</p>
                                    </div>
                                </div>
                            )}

                            {!loading && !error && filteredZipcodes.length > 0 && (
                                <div className="h-72">
                                    <div className="h-full overflow-y-auto border border-gray-200 rounded-md">
                                        <table className="w-full text-sm border-collapse">
                                            <thead className="table-title2 sticky top-0 z-10">
                                                <tr className="border-b border-gray-200">
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-[140px]">
                                                        郵便番号
                                                    </th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">
                                                        地域
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredZipcodes.map((zip, index) => {
                                                    const isResidence = zip.flag === 1;
                                                    return (
                                                        <tr
                                                            key={`zipcode-${index}`}
                                                            className="table-hover border-b border-gray-100"
                                                        >
                                                            <td
                                                                className={`px-3 py-2 font-mono font-semibold whitespace-nowrap ${isResidence ? "text-blue-600" : "text-green-600"
                                                                    }`}
                                                            >
                                                                〒{zip.zipcode}
                                                            </td>
                                                            <td className="px-3 py-2 text-gray-700">
                                                                {zip.town || "-"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
}