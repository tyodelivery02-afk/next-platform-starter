"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { X, Triangle, Download } from "phosphor-react";
import { downloadZipcodeCSV } from "../utils";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

function MiniPieChart({ selected, total, color, loading }) {
    const rest = Math.max(0, total - selected);
    const hasData = total > 0 && selected > 0;

    const data = {
        labels: ["色付き", "その他"],
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
                    title: () => "",
                    label: (ctx) => {
                        if (!hasData) return "データなし";
                        const pct = ((ctx.raw / total) * 100).toFixed(1);
                        return `${ctx.label}: ${pct}%`;
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
    const [zipcodeLoading, setZipcodeLoading] = useState(false);

    const [prefZipcodes, setPrefZipcodes] = useState([]);
    const [prefZipcodeLoading, setPrefZipcodeLoading] = useState(false);
    const [prefZipcodeError, setPrefZipcodeError] = useState(null);

    const [popView, setPopView] = useState(0);
    const [zipView, setZipView] = useState(0);
    const [areaView, setAreaView] = useState(0);

    const [housingStats, setHousingStats] = useState(null);
    const [housingLoading, setHousingLoading] = useState(false);
    const [housingLoadedOnce, setHousingLoadedOnce] = useState(false);

    const [housingMenuOpen, setHousingMenuOpen] = useState(false);
    const housingMenuRef = useRef(null);

    const [housingView, setHousingView] = useState(0);
    const [housingMetric, setHousingMetric] = useState("totalHousing");
    const prefStatsCacheRef = useRef(new Map());
    const tooltipRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const [adjustedPos, setAdjustedPos] = useState({ left: 0, top: 0 });

    const TOOLTIP_W = 720;
    const selectedCodesParam = useMemo(
        () => (stats?.prefSelectedCodes || []).join(","),
        [stats?.prefSelectedCodes]
    );

    const selectedCodesInPref = useMemo(
        () => (stats?.prefSelectedCodes || []).filter((code) => code.startsWith(prefCode || "")),
        [stats?.prefSelectedCodes, prefCode]
    );

    const updateTooltipPosition = useCallback(() => {
        if (!position) return;

        const GAP = 15;
        const MARGIN = 8;
        const el = tooltipRef.current;
        const tooltipH = el ? el.offsetHeight : 430;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let left = position.x + GAP;
        let top = position.y + GAP;

        if (left + TOOLTIP_W > winW - MARGIN) {
            left = position.x - TOOLTIP_W - GAP;
        }
        if (left < MARGIN) {
            left = MARGIN;
        }

        if (top + tooltipH > winH - MARGIN) {
            top = position.y - tooltipH - GAP;
        }
        if (top < MARGIN) {
            top = MARGIN;
        }

        setAdjustedPos({ left, top });
    }, [position]);

    useEffect(() => {
        if (!prefCode) {
            setZipcodeStats(null);
            setZipcodeLoading(false);
            return;
        }

        const requestKey = `${prefCode}__${selectedCodesParam}`;
        const cached = prefStatsCacheRef.current.get(requestKey);

        if (cached) {
            setZipcodeStats(cached);
            setZipcodeLoading(false);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        const fetchPrefStats = async () => {
            setZipcodeLoading(true);

            try {
                const res = await fetch(
                    `/api/zipcode/pref-stats?prefCode=${prefCode}&selectedCodes=${selectedCodesParam}`,
                    { signal: controller.signal }
                );
                if (!res.ok) throw new Error("fetch failed");

                const data = await res.json();

                if (!cancelled) {
                    prefStatsCacheRef.current.set(requestKey, data);
                    setZipcodeStats(data);
                }
            } catch (err) {
                if (!cancelled && err.name !== "AbortError") {
                    setZipcodeStats(null);
                }
            } finally {
                if (!cancelled) {
                    setZipcodeLoading(false);
                }
            }
        };

        fetchPrefStats();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [prefCode, selectedCodesParam]);

    useEffect(() => {
        if (!prefCode) {
            setPrefZipcodes([]);
            setPrefZipcodeLoading(false);
            setPrefZipcodeError(null);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        const fetchPrefZipcodes = async () => {
            setPrefZipcodeLoading(true);
            setPrefZipcodeError(null);
            setPrefZipcodes([]);

            try {
                const res = await fetch(`/api/zipcode/pref?prefCode=${encodeURIComponent(prefCode)}`, {
                    signal: controller.signal,
                });
                if (!res.ok) {
                    throw new Error(`郵便番号の取得に失敗しました (${res.status})`);
                }

                const data = await res.json();

                if (!cancelled) {
                    if (data.success) {
                        setPrefZipcodes(data.zipcodes || []);
                    } else {
                        setPrefZipcodeError(data.error || "郵便番号の取得に失敗しました");
                    }
                }
            } catch (err) {
                if (!cancelled && err.name !== "AbortError") {
                    console.error("県郵便番号取得エラー:", err);
                    setPrefZipcodeError(err.message || "郵便番号の取得に失敗しました");
                }
            } finally {
                if (!cancelled) {
                    setPrefZipcodeLoading(false);
                }
            }
        };

        fetchPrefZipcodes();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [prefCode]);

    useEffect(() => {
        if (!prefCode) {
            setHousingStats(null);
            setHousingLoading(false);
            setHousingLoadedOnce(false);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        const fetchHousingStats = async () => {
            setHousingLoading(true);
            setHousingStats(null);
            setHousingLoadedOnce(false);

            try {
                const [prefRes, nationalRes, selectedSettled] = await Promise.all([
                    fetch(`/api/population/estat?level=housing-pref&prefCode=${prefCode}`, {
                        signal: controller.signal,
                    }).then((res) => {
                        if (!res.ok) throw new Error("pref housing fetch failed");
                        return res.json();
                    }),
                    fetch(`/api/population/estat?level=housing&areaCode=00000`, {
                        signal: controller.signal,
                    }).then((res) => {
                        if (!res.ok) throw new Error("national housing fetch failed");
                        return res.json();
                    }),
                    Promise.allSettled(
                        selectedCodesInPref.map(async (code) => {
                            const res = await fetch(
                                `/api/population/estat?level=housing&areaCode=${code}`,
                                { signal: controller.signal }
                            );
                            if (!res.ok) throw new Error(`housing fetch failed: ${code}`);
                            return res.json();
                        })
                    ),
                ]);

                const successfulSelectedList = selectedSettled
                    .filter((item) => item.status === "fulfilled")
                    .map((item) => item.value);

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

                    list.forEach((item) => {
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

                if (!cancelled) {
                    setHousingStats({
                        selected: sumHousingStats(successfulSelectedList),
                        pref: prefRes?.housingStats || null,
                        national: nationalRes?.housingStats || null,
                    });
                    setHousingLoadedOnce(true);
                }
            } catch (err) {
                if (!cancelled && err.name !== "AbortError") {
                    setHousingStats(null);
                    setHousingLoadedOnce(true);
                }
            } finally {
                if (!cancelled) {
                    setHousingLoading(false);
                }
            }
        };

        fetchHousingStats();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [prefCode, selectedCodesInPref]);

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
    }, [position, isVisible, updateTooltipPosition]);

    useEffect(() => {
        if (!tooltipRef.current || !position || !isVisible) return;

        if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
        }

        const observer = new ResizeObserver(() => {
            updateTooltipPosition();
        });

        resizeObserverRef.current = observer;
        observer.observe(tooltipRef.current);

        return () => {
            observer.disconnect();
            resizeObserverRef.current = null;
        };
    }, [position, isVisible, updateTooltipPosition]);

    useEffect(() => {
        const onWindowChange = () => updateTooltipPosition();

        if (isVisible) {
            window.addEventListener("resize", onWindowChange);
            window.addEventListener("scroll", onWindowChange, true);
        }

        return () => {
            window.removeEventListener("resize", onWindowChange);
            window.removeEventListener("scroll", onWindowChange, true);
        };
    }, [isVisible, updateTooltipPosition]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (housingMenuRef.current && !housingMenuRef.current.contains(event.target)) {
                setHousingMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (!position) return null;

    const {
        selectedPop = 0,
        totalPrefPop = 0,
        nationalPop = 0,
        selectedAreaCount = 0,
        selectedArea = 0,
        totalPrefArea = 0,
    } = stats || {};

    const popChartSelected = selectedPop;
    const popChartTotal = popView === 0 ? totalPrefPop : nationalPop;

    const selectedZipcodes = zipcodeStats?.selectedZipcodes ?? 0;
    const prefTotalZipcodes = zipcodeStats?.prefTotalZipcodes ?? 0;
    const nationalTotalZipcodes = zipcodeStats?.nationalTotalZipcodes ?? 0;

    const zipSelected = selectedZipcodes;
    const zipTotal = zipView === 0 ? prefTotalZipcodes : nationalTotalZipcodes;

    const housingSelected = housingStats?.selected?.[housingMetric] ?? 0;
    const housingTotal =
        housingView === 0
            ? housingStats?.pref?.[housingMetric] ?? 0
            : housingStats?.national?.[housingMetric] ?? 0;

    const popRatePref = totalPrefPop > 0 ? selectedPop / totalPrefPop : 0;
    const areaRatePref = totalPrefArea > 0 ? selectedArea / totalPrefArea : 0;
    const aEff = areaRatePref > 0 ? (popRatePref / areaRatePref).toFixed(2) : null;

    const zipRatePref = prefTotalZipcodes > 0 ? selectedZipcodes / prefTotalZipcodes : 0;
    const nEff = zipRatePref > 0 ? (popRatePref / zipRatePref).toFixed(2) : null;
    const nationalAreaHa = 37797528; // 377,975.28 km² = 37,797,528 ha
    const areaChartSelected = selectedArea;
    const areaChartTotal = areaView === 0 ? totalPrefArea : nationalAreaHa;
    const areaRateChart = areaChartTotal > 0 ? areaChartSelected / areaChartTotal : 0;

    const housingRateBase =
        housingView === 0
            ? (housingStats?.pref?.totalHousing ?? 0)
            : (housingStats?.national?.totalHousing ?? 0);

    const housingRateSelected = housingStats?.selected?.totalHousing ?? 0;
    const hEff =
        housingRateBase > 0 && popRatePref > 0
            ? (popRatePref / (housingRateSelected / housingRateBase)).toFixed(2)
            : null;

    const selectedHousingTotal = housingStats?.selected?.totalHousing ?? 0;
    const prefHousingTotal = housingStats?.pref?.totalHousing ?? 0;

    const selectedPopDensity =
        selectedArea > 0 ? selectedPop / selectedArea : 0;
    const prefPopDensity =
        totalPrefArea > 0 ? totalPrefPop / totalPrefArea : 0;

    const selectedHousingDensity =
        selectedArea > 0 ? selectedHousingTotal / selectedArea : 0;
    const prefHousingDensity =
        totalPrefArea > 0 ? prefHousingTotal / totalPrefArea : 0;

    const popAggEff =
        prefPopDensity > 0 ? (selectedPopDensity / prefPopDensity).toFixed(2) : null;

    const housingAggEff =
        prefHousingDensity > 0 ? (selectedHousingDensity / prefHousingDensity).toFixed(2) : null;

    const hasSelection = selectedAreaCount > 0;
    const isAnyLoading = zipcodeLoading || housingLoading;
    const hasRenderableData =
        selectedPop > 0 || zipSelected > 0 || housingSelected > 0 || aEff !== null || nEff !== null;
    const showCharts = hasSelection && (isAnyLoading || hasRenderableData);

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

    const tabBtn = (active) =>
        `px-2 py-0.5 rounded text-xs font-semibold transition-colors ${active ? "bg-sky-400 text-white" : "select-button"
        }`;

    const downloadPrefZipcodesCSV = () => {
        if (prefZipcodes.length === 0) return;

        const rows = prefZipcodes.map((zip) => {
            const type = zip.flag === 1 ? "住所" : "事務所";
            const zipcode = zip.zipcode || "";
            const city =
                zip.city ||
                zip.city_kanji ||
                zip.municipality ||
                zip.municipality_name ||
                "";
            const town = zip.town || "";

            return [type, zipcode, city, town];
        });

        downloadZipcodeCSV({
            filename: `${prefName || prefCode}_郵便番号.csv`,
            rows,
        });
    };

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
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-lg text-black">
                    {prefName || `都道府県 ${prefCode}`}
                </h3>

                <div className="flex items-center gap-2">
                    <button
                        onClick={downloadPrefZipcodesCSV}
                        disabled={prefZipcodeLoading || !!prefZipcodeError || prefZipcodes.length === 0}
                        className="floppyDisk-button"
                        title="郵便番号CSV出力"
                    >
                        <Download size={24} weight="bold" />
                    </button>

                    <button onClick={onClose} className="x-button">
                        <X size={24} weight="bold" />
                    </button>
                </div>
            </div>

            <div className="bg-yellow-100 px-4 py-2 flex items-center text-sm text-black">
                <span className="font-bold">
                    {selectedAreaCount}
                    <span className="text-xs font-normal ml-1">個のエリアが色付けされています</span>
                </span>
            </div>

            <div className="p-4 bg-sky-50 text-black">
                {showCharts ? (
                    <div className="grid grid-cols-4 gap-4 min-h-[430px]">
                        {(aEff !== null || nEff !== null || hEff !== null || popAggEff !== null || housingAggEff !== null || isAnyLoading) && (
                            <div className="mt-2 p-2 grid grid-cols-6 gap-2 col-span-4">
                                <div className="flex flex-col table-details items-center col-span-2">
                                    <span className="text-xs mb-1 mt-2">面積効率</span>
                                    <span
                                        className={`text-2xl font-bold ${aEff !== null
                                            ? parseFloat(aEff) < 1
                                                ? "text-slate-400"
                                                : parseFloat(aEff) > 5
                                                    ? "text-amber-500"
                                                    : "text-emerald-500"
                                            : "text-gray-300"
                                            }`}
                                    >
                                        {aEff !== null ? aEff : isAnyLoading ? "…" : "—"}
                                    </span>
                                </div>
                                <div className="flex flex-col table-details items-center col-span-2">
                                    <span className="text-xs mb-1 mt-2">郵便番号効率</span>
                                    <span
                                        className={`text-2xl font-bold ${!zipcodeLoading && nEff !== null
                                            ? parseFloat(nEff) < 1
                                                ? "text-slate-400"
                                                : parseFloat(nEff) > 5
                                                    ? "text-amber-500"
                                                    : "text-emerald-500"
                                            : "text-gray-300"
                                            }`}
                                    >
                                        {!zipcodeLoading && nEff !== null ? nEff : zipcodeLoading ? "…" : "—"}
                                    </span>
                                </div>
                                <div className="flex flex-col table-details items-center col-span-2">
                                    <span className="text-xs mb-1 mt-2">住宅効率</span>
                                    <span
                                        className={`text-2xl font-bold ${!housingLoading && hEff !== null
                                            ? parseFloat(hEff) < 1
                                                ? "text-slate-400"
                                                : parseFloat(hEff) > 5
                                                    ? "text-amber-500"
                                                    : "text-emerald-500"
                                            : "text-gray-300"
                                            }`}
                                    >
                                        {!housingLoading && hEff !== null ? hEff : housingLoading ? "…" : "—"}
                                    </span>
                                </div>
                                <div className="flex flex-col table-details items-center col-span-3">
                                    <span className="text-xs mb-1 mt-2">人口集約度</span>
                                    <span
                                        className={`text-2xl font-bold ${popAggEff !== null
                                            ? parseFloat(popAggEff) < 1
                                                ? "text-slate-400"
                                                : parseFloat(popAggEff) > 1.5
                                                    ? "text-amber-500"
                                                    : "text-emerald-500"
                                            : "text-gray-300"
                                            }`}
                                    >
                                        {popAggEff !== null ? popAggEff : isAnyLoading ? "…" : "—"}
                                    </span>
                                </div>

                                <div className="flex flex-col table-details items-center col-span-3">
                                    <span className="text-xs mb-1 mt-2">住宅集約度</span>
                                    <span
                                        className={`text-2xl font-bold ${housingAggEff !== null
                                            ? parseFloat(housingAggEff) < 1
                                                ? "text-slate-400"
                                                : parseFloat(housingAggEff) > 1.5
                                                    ? "text-amber-500"
                                                    : "text-emerald-500"
                                            : "text-gray-300"
                                            }`}
                                    >
                                        {housingAggEff !== null ? housingAggEff : housingLoading ? "…" : "—"}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="table-details p-2 flex flex-col items-center gap-2">
                            <div className="flex items-center justify-between w-full">
                                <span className="text-xs font-bold">人口</span>
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
                                color="#38bdf8"
                                loading={false}
                            />

                            <div className="w-full text-xs font-mono space-y-0.5">
                                <div className="flex justify-between">
                                    <span>色付き</span>
                                    <span className="font-bold">{selectedPop.toLocaleString()} 人</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{popView === 0 ? "県合計" : "全国合計"}</span>
                                    <span>{popChartTotal.toLocaleString()} 人</span>
                                </div>
                            </div>
                        </div>

                        <div className="table-details p-2 flex flex-col items-center gap-2">
                            <div className="flex items-center justify-between w-full">
                                <span className="text-xs font-bold text-gray-600">郵便番号</span>
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
                                color="#f59e0b"
                                loading={zipcodeLoading}
                            />

                            <div className="w-full text-xs font-mono space-y-0.5">
                                {zipcodeLoading ? (
                                    <p className="text-center text-gray-400 animate-pulse">読み込み中...</p>
                                ) : (
                                    <>
                                        <div className="flex justify-between">
                                            <span>色付き</span>
                                            <span className="font-bold">{zipSelected.toLocaleString()} 件</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{zipView === 0 ? "県合計" : "全国合計"}</span>
                                            <span>{zipTotal.toLocaleString()} 件</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="table-details p-2 flex flex-col items-center gap-2">
                            <div className="flex items-center justify-between w-full">
                                <span className="text-xs font-bold text-gray-600">面積</span>
                                <div className="flex gap-1">
                                    <button className={tabBtn(areaView === 0)} onClick={() => setAreaView(0)}>
                                        県内
                                    </button>
                                    <button className={tabBtn(areaView === 1)} onClick={() => setAreaView(1)}>
                                        全国
                                    </button>
                                </div>
                            </div>

                            <MiniPieChart
                                selected={areaChartSelected}
                                total={areaChartTotal}
                                color="#a78bfa"
                                loading={false}
                            />

                            <div className="w-full text-xs font-mono space-y-0.5">
                                <div className="flex justify-between">
                                    <span>色付き</span>
                                    <span className="font-bold">{selectedArea.toLocaleString()} ha</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{areaView === 0 ? "県合計" : "全国合計"}</span>
                                    <span>{areaChartTotal.toLocaleString()} ha</span>
                                </div>
                            </div>
                        </div>

                        <div className="table-details p-2 flex flex-col items-center gap-2">
                            <div className="flex items-start justify-between w-full gap-2">
                                <span className="text-xs font-bold text-gray-600 pt-1">住宅</span>

                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                    <button className={tabBtn(housingView === 0)} onClick={() => setHousingView(0)}>
                                        県内
                                    </button>
                                    <button className={tabBtn(housingView === 1)} onClick={() => setHousingView(1)}>
                                        全国
                                    </button>

                                    <div ref={housingMenuRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setHousingMenuOpen((prev) => !prev)}
                                            className={`relative w-5 h-5 rounded group flex items-center justify-center text-white bg-sky-700 shadow-md transition-all duration-300
            hover:bg-sky-800 hover:shadow-yellow-400
            ${housingMenuOpen ? "bg-sky-800 shadow-yellow-400" : ""}`}
                                            title="住宅属性を選択"
                                        >
                                            <Triangle
                                                size={12}
                                                weight="bold"
                                                style={{
                                                    transform: housingMenuOpen ? "rotate(90deg)" : "scaleY(-1)",
                                                    transition: "transform 0.2s ease",
                                                }}
                                            />
                                        </button>

                                        <div
                                            className={`absolute right-full top-1/2 -translate-y-1/2 mr-2 z-30 origin-right transition-all duration-200
            ${housingMenuOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}
                                        >
                                            <div className="min-w-[180px] max-h-64 overflow-y-auto bg-white/95 backdrop-blur-sm border border-sky-200 shadow-xl
                        rounded-l-[28px] rounded-tr-[10px] rounded-br-[28px] p-2">
                                                <div className="flex flex-col gap-1">
                                                    {housingMetricOptions.map((opt) => {
                                                        const active = housingMetric === opt.value;

                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                onClick={() => {
                                                                    setHousingMetric(opt.value);
                                                                    setHousingMenuOpen(false);
                                                                }}
                                                                className={`text-left text-xs px-3 py-2 rounded-xl transition-all duration-150
                                ${active
                                                                        ? "bg-sky-500 text-white font-semibold shadow-sm"
                                                                        : "text-black hover:bg-yellow-200"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
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
                                            <span>色付き</span>
                                            <span className="font-bold">{housingSelected.toLocaleString()} 件</span>
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
                ) : hasSelection && !housingLoadedOnce && isAnyLoading ? (
                    <div className="table-details min-h-[430px] flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 border-4 border-sky-300 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-500">統計データを読み込み中...</p>
                    </div>
                ) : (
                    <div className="table-details min-h-[430px] relative overflow-hidden p-[3px]">
                        <div className="relative w-full h-full min-h-[424px]">
                            <Image
                                src="/images/wagayuku.jpg"
                                alt="未選択"
                                fill
                                className="object-cover opacity-90 rounded-[inherit]"
                                sizes="720px"
                                priority={false}
                            />
                            <p className="absolute bottom-0 left-0 right-0 z-10 text-5xl text-white text-center py-2 bg-black/35 backdrop-blur-[1px]">
                                我が征くは星の大海
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}