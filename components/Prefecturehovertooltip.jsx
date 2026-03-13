"use client";
import { useEffect, useState, useRef } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { X, Triangle } from "phosphor-react";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

function MiniPieChart({ selected, total, label, color, loading }) {
    const rest = Math.max(0, total - selected);
    const hasData = total > 0 && selected > 0;

    const ratio = total > 0 ? ((selected / total) * 100).toFixed(2) : "0.00";

    const data = {
        labels: ["選択済み", "その他"],
        datasets: [
            {
                data: hasData ? [selected, rest] : [0, 1],
                backgroundColor: hasData ? [color, "#e5e7eb"] : ["#e5e7eb", "#e5e7eb"],
                borderWidth: 2,
                borderColor: "#fff",
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 400 },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        if (!hasData) return "データなし";
                        const val = ctx.raw;
                        // const pct = ((val / total) * 100).toFixed(2);
                        return `${ctx.label}: ${val.toLocaleString()}`;
                    },
                },
            },
            datalabels: {
                display: hasData,
                color: "#000000",
                font: { weight: "bold", size: 11 },
                formatter: (value, ctx) => {
                    const pct = ((value / total) * 100).toFixed(1);
                    return ctx.dataIndex === 0 ? `${pct}%` : "";
                },
            },
        },
    };

    return (
        <div className="flex flex-col items-center">
            <div style={{ width: 120, height: 120, position: "relative" }}>
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-sky-300 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <Pie data={data} options={options} />
                )}
            </div>
            <p className="mt-1 text-xs text-black">{label}</p>
        </div>
    );
}

export default function PrefectureHoverTooltip({
    prefCode,
    prefName,
    stats,
    position,
    isVisible,
    onClose,
    onMouseEnter,
    onMouseLeave,
}) {
    const [zipcodeStats, setZipcodeStats] = useState(null);
    const [zipcodeLoading, setZipcodeLoading] = useState(true);
    const fetchedCodeRef = useRef(null);

    // 0 = 県ベース, 1 = 全国ベース
    const [popView, setPopView] = useState(0);
    const [zipView, setZipView] = useState(0);

    const [housingStats, setHousingStats] = useState(null);
    const [housingLoading, setHousingLoading] = useState(true);
    const [housingView, setHousingView] = useState(0); // 0 = 県内, 1 = 全国
    const [housingMetric, setHousingMetric] = useState("totalHousing");

    useEffect(() => {
        if (!prefCode) return;
        if (fetchedCodeRef.current === prefCode) return;

        fetchedCodeRef.current = prefCode;
        setZipcodeLoading(true);
        setZipcodeStats(null);

        const codesParam = (stats?.prefSelectedCodes || []).join(",");
        fetch(`/api/zipcode/pref-stats?prefCode=${prefCode}&selectedCodes=${codesParam}`)
            .then((res) => {
                if (!res.ok) throw new Error("fetch failed");
                return res.json();
            })
            .then((data) => {
                setZipcodeStats(data);
                setZipcodeLoading(false);
            })
            .catch(() => {
                setZipcodeStats(null);
                setZipcodeLoading(false);
            });
    }, [prefCode, stats?.prefSelectedCodes]);

    useEffect(() => {
        if (!prefCode) return;

        const fetchHousingStats = async () => {
            setHousingLoading(true);
            setHousingStats(null);

            try {
                const selectedCodesInPref = (stats?.prefSelectedCodes || []).filter(code =>
                    code.startsWith(prefCode)
                );

                // 1. 当前都道府県整体住房数据
                const prefRes = await fetch(`/api/population/estat?level=housing-pref&prefCode=${prefCode}`);
                const prefJson = await prefRes.json();

                // 2. 全国住房数据
                const nationalRes = await fetch(`/api/population/estat?level=housing&areaCode=00000`);
                const nationalJson = await nationalRes.json();

                // 3. 当前选中的市区町村住房数据汇总
                const selectedList = await Promise.all(
                    selectedCodesInPref.map(async (code) => {
                        const res = await fetch(`/api/population/estat?level=housing&areaCode=${code}`);
                        return res.json();
                    })
                );

                const sumHousingStats = (list) => {
                    const result = {
                        totalHousing: 0,
                        apartment: 0,
                        detached: 0,
                        rowhouseOther: 0,
                        ownerOccupied: 0,
                        privateRental: 0,
                        publicEtcRental: 0,
                        exclusiveResidence: 0,
                        mixedUseResidence: 0,
                    };

                    list.forEach(item => {
                        const hs = item?.housingStats || {};
                        result.totalHousing += Number(hs.totalHousing || 0);
                        result.apartment += Number(hs.apartment || 0);
                        result.detached += Number(hs.detached || 0);
                        result.rowhouseOther += Number(hs.rowhouseOther || 0);
                        result.ownerOccupied += Number(hs.ownerOccupied || 0);
                        result.privateRental += Number(hs.privateRental || 0);
                        result.publicEtcRental += Number(hs.publicEtcRental || 0);
                        result.exclusiveResidence += Number(hs.exclusiveResidence || 0);
                        result.mixedUseResidence += Number(hs.mixedUseResidence || 0);
                    });

                    return result;
                };

                setHousingStats({
                    selected: sumHousingStats(selectedList),
                    pref: prefJson?.housingStats || null,
                    national: nationalJson?.housingStats || null,
                });
            } catch {
                setHousingStats(null);
            } finally {
                setHousingLoading(false);
            }
        };

        fetchHousingStats();
    }, [prefCode, stats?.prefSelectedCodes]);


    const tooltipRef = useRef(null);
    const [adjustedPos, setAdjustedPos] = useState({ left: 0, top: 0 });

    const TOOLTIP_W = 720;

    useEffect(() => {
        if (!position) return;

        const GAP = 15;
        const MARGIN = 8;
        const el = tooltipRef.current;
        const tooltipH = el ? el.offsetHeight : 380;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let left = position.x + GAP;
        let top = position.y + GAP;

        // 右端溢出 → 左側に表示
        if (left + TOOLTIP_W > winW - MARGIN) {
            left = position.x - TOOLTIP_W - GAP;
        }
        // 左端溢出
        if (left < MARGIN) {
            left = MARGIN;
        }

        // 下端溢出 → 上側に表示
        if (top + tooltipH > winH - MARGIN) {
            top = position.y - tooltipH - GAP;
        }
        // 上端溢出
        if (top < MARGIN) {
            top = MARGIN;
        }

        setAdjustedPos({ left, top });
    }, [position, isVisible]);

    if (!position) return null;

    const {
        selectedPop = 0,
        totalPrefPop = 0,
        nationalPop = 0,
        selectedAreaCount = 0,
        selectedArea = 0,
        totalPrefArea = 0,
    } = stats || {};

    // 人口グラフのデータ
    const popChartSelected = selectedPop;
    const popChartTotal = popView === 0 ? totalPrefPop : nationalPop;
    const popLabel = popView === 0 ? "県内人口ベース" : "全国人口ベース";

    // 郵便番号グラフのデータ
    const zipSelected = zipcodeStats?.selectedZipcodes ?? 0;
    const zipTotal =
        zipView === 0
            ? zipcodeStats?.prefTotalZipcodes ?? 0
            : zipcodeStats?.nationalTotalZipcodes ?? 0;
    const zipLabel = zipView === 0 ? "県内郵便番号ベース" : "全国郵便番号ベース";

    const housingSelected = housingStats?.selected?.[housingMetric] ?? 0;
    const housingTotal =
        housingView === 0
            ? housingStats?.pref?.[housingMetric] ?? 0
            : housingStats?.national?.[housingMetric] ?? 0;
    // 面積効率 A-Eff = (selectedPop/totalPrefPop) / (selectedArea/totalPrefArea)
    const popRatePref = totalPrefPop > 0 ? selectedPop / totalPrefPop : 0;
    const areaRatePref = totalPrefArea > 0 ? selectedArea / totalPrefArea : 0;
    const aEff = areaRatePref > 0 ? (popRatePref / areaRatePref).toFixed(2) : null;

    // 選区効率 N-Eff = (selectedPop/totalPrefPop) / (selectedZipcodes/prefTotalZipcodes)
    const zipRatePref = zipcodeStats && zipcodeStats.prefTotalZipcodes > 0
        ? zipcodeStats.selectedZipcodes / zipcodeStats.prefTotalZipcodes : 0;
    const nEff = zipRatePref > 0 ? (popRatePref / zipRatePref).toFixed(2) : null;

    const housingMetricOptions = [
        { value: "totalHousing", label: "全住房" },
        { value: "apartment", label: "共同住宅" },
        { value: "detached", label: "一戸建" },
        { value: "rowhouseOther", label: "長屋建・その他" },
        { value: "ownerOccupied", label: "持ち家" },
        { value: "privateRental", label: "民営借家" },
        { value: "publicEtcRental", label: "公営等借家" },
        { value: "exclusiveResidence", label: "専用住宅" },
        { value: "mixedUseResidence", label: "店舗その他の併用住宅" },
    ];

    // 切替ボタン共通スタイル
    const tabBtn = (active) =>
        `px-2 py-0.5 rounded text-xs font-semibold transition-colors ${active
            ? "bg-sky-400 text-white"
            : "select-button"
        }`;

    return (
        <div
            ref={tooltipRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                position: "fixed",
                left: adjustedPos.left,
                top: adjustedPos.top,
                width: TOOLTIP_W,
                zIndex: 9999,
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0px) scale(1)" : "translateY(6px) scale(0.97)",
                transition: "opacity 0.2s ease, transform 0.2s ease",
                pointerEvents: isVisible ? "auto" : "none",
            }}
            className="bg-white border-2 border-gray-300 rounded-xl shadow-xl overflow-hidden"
        >
            {/* ヘッダー */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-lg text-black">
                    {prefName || `都道府県 ${prefCode}`}
                </h3>
                <button
                    onClick={onClose}
                    className="x-button"
                >
                    <X size={24} weight="bold" />
                </button>
            </div>

            {/* 選択エリアサマリー */}
            <div className="bg-yellow-100 px-4 py-2 flex items-center text-sm text-black">
                <span className="font-bold">
                    {selectedAreaCount}
                    <span className="text-xs font-normal ml-1">個のエリアが選択されています</span>
                </span>
            </div>

            {/* 2つのグラフ横並び */}
            <div className="p-4 bg-sky-50 text-black grid grid-cols-3 gap-4">
                {/* A-Eff / N-Eff */}
                {(aEff !== null || nEff !== null) && (
                    <div className="mt-3 p-3 table-details grid grid-cols-2 gap-3 col-span-3">
                        <div className="flex flex-col items-center">
                            <span className="text-xs mb-1">面積効率</span>
                            <span className={`text-2xl font-bold ${aEff !== null
                                ? (parseFloat(aEff) < 1 ? "text-slate-400" : parseFloat(aEff) > 5 ? "text-amber-500" : "text-emerald-500")
                                : "text-gray-300"
                                }`}>
                                {aEff !== null ? aEff : "—"}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs mb-1">郵便番号選区効率</span>
                            <span className={`text-2xl font-bold ${!zipcodeLoading && nEff !== null
                                ? (parseFloat(nEff) < 1 ? "text-slate-400" : parseFloat(nEff) > 5 ? "text-amber-500" : "text-emerald-500")
                                : "text-gray-300"
                                }`}>
                                {!zipcodeLoading && nEff !== null ? nEff : zipcodeLoading ? "…" : "—"}
                            </span>
                        </div>
                    </div>
                )}

                {/* ── 人口占比 ── */}
                <div className="table-details p-3 flex flex-col items-center gap-3">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold">人口シェア</span>
                        <div className="flex gap-1">
                            <button className={tabBtn(popView === 0)} onClick={() => setPopView(0)}>
                                県内
                            </button>
                            <button className={tabBtn(popView === 1)} onClick={() => setPopView(1)}>
                                全国
                            </button>
                        </div>
                    </div>

                    <MiniPieChart
                        selected={popChartSelected}
                        total={popChartTotal}
                        // label={popLabel}
                        color="#38bdf8"
                        loading={false}
                    />

                    {/* 補足数字 */}
                    <div className="w-full text-xs font-mono space-y-0.5">
                        <div className="flex justify-between">
                            <span>選択済み</span>
                            <span className="font-bold">
                                {selectedPop.toLocaleString()} 人
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>{popView === 0 ? "県合計" : "全国合計"}</span>
                            <span>{popChartTotal.toLocaleString()} 人</span>
                        </div>
                    </div>
                </div>

                {/* ── 郵便番号占比 ── */}
                <div className="table-details p-3 flex flex-col items-center gap-3">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-gray-600">郵便番号シェア</span>
                        <div className="flex gap-1">
                            <button className={tabBtn(zipView === 0)} onClick={() => setZipView(0)}>
                                県内
                            </button>
                            <button className={tabBtn(zipView === 1)} onClick={() => setZipView(1)}>
                                全国
                            </button>
                        </div>
                    </div>

                    <MiniPieChart
                        selected={zipSelected}
                        total={zipTotal}
                        // label={zipLabel}
                        color="#f59e0b"
                        loading={zipcodeLoading}
                    />

                    {/* 補足数字 */}
                    <div className="w-full text-xs font-mono space-y-0.5">
                        {zipcodeLoading ? (
                            <p className="text-center text-gray-400 animate-pulse">読み込み中...</p>
                        ) : (
                            <>
                                <div className="flex justify-between">
                                    <span>選択済み</span>
                                    <span className="font-bold">
                                        {zipSelected.toLocaleString()} 件
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{zipView === 0 ? "県合計" : "全国合計"}</span>
                                    <span>{zipTotal.toLocaleString()} 件</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── 住房属性占比 ── */}
                <div className="table-details p-3 flex flex-col items-center gap-3">
                    <div className="flex items-start justify-between w-full gap-2">
                        <span className="text-xs font-bold text-gray-600 pt-1">住宅属性シェア</span>

                        <div className="flex items-center gap-1 flex-wrap justify-end">
                            <button className={tabBtn(housingView === 0)} onClick={() => setHousingView(0)}>
                                県内
                            </button>
                            <button className={tabBtn(housingView === 1)} onClick={() => setHousingView(1)}>
                                全国
                            </button>

                            <div className="relative w-5 h-5 rounded group">
                                <select
                                    value={housingMetric}
                                    onChange={(e) => setHousingMetric(e.target.value)}
                                    className="absolute inset-0 w-full h-full table-style1 appearance-none cursor-pointer opacity-0 z-10"
                                >
                                    {housingMetricOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>

                                <div className="absolute inset-0 text-white bg-sky-700 shadow-md group-hover:bg-sky-800 group-hover:shadow-md group-hover:shadow-yellow-400 group-focus-within:bg-sky-800 group-focus-within:shadow-md group-focus-within:shadow-yellow-400 transition-all duration-300 pointer-events-none flex items-center justify-center rounded-sm">
                                    <Triangle size={12} weight="bold" style={{ transform: "scaleY(-1)" }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <MiniPieChart
                        selected={housingSelected}
                        total={housingTotal}
                        color="#10b981"
                        loading={housingLoading}
                    />

                    <div className="w-full text-xs font-mono space-y-0.5">
                        {housingLoading ? (
                            <p className="text-center text-gray-400 animate-pulse">読み込み中...</p>
                        ) : (
                            <>
                                <div className="flex justify-between">
                                    <span>選択済み</span>
                                    <span className="font-bold">
                                        {housingSelected.toLocaleString()} 件
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{housingView === 0 ? "県合計" : "全国合計"}</span>
                                    <span>{housingTotal.toLocaleString()} 件</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}