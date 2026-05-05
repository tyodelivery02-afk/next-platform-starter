"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { downloadZipcodeCSV } from "../utils";
import { ArrowLeft, X, Download } from "phosphor-react";

function HorizontalRatioBar({
    label,
    selected,
    total,
    color = "#38bdf8",
    loading = false,
    selectedLabel = "色付き",
    totalLabel = "県合計",
    unit = "",
    view,
    setView,
    tabBtn,
    children,
}) {
    const safeSelected = Number(selected || 0);
    const safeTotal = Number(total || 0);
    const percent = safeTotal > 0 ? Math.min(100, (safeSelected / safeTotal) * 100) : 0;

    const formatValue = (value) => {
        if (loading) return "読み込み中...";
        return `${value.toLocaleString()}${unit}`;
    };

    return (
        <div className="table-details p-3 rounded-lg">
            <div className="flex justify-between items-center gap-2 mb-2">
                <span className="text-sm font-bold">{label}</span>

                <div className="flex items-center gap-1">
                    {children}

                    {typeof view === "number" && typeof setView === "function" && (
                        <>
                            <button onClick={() => setView(0)} className={tabBtn(view === 0)}>
                                県内
                            </button>
                            <button onClick={() => setView(1)} className={tabBtn(view === 1)}>
                                全国
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                <span>
                    {selectedLabel}：{formatValue(safeSelected)}
                </span>
                <span>
                    {totalLabel}：{formatValue(safeTotal)}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                            width: loading ? "35%" : `${percent}%`,
                            backgroundColor: color,
                        }}
                    />
                </div>

                <span className="w-12 text-right text-xs font-semibold text-gray-600">
                    {loading ? "…" : `${percent.toFixed(1)}%`}
                </span>
            </div>
        </div>
    );
}

export default function PrefectureHoverTooltip({
    prefCode,
    prefName,
    stats,
    position,
    isVisible = true,
    onClose,
    onMouseEnter,
    onMouseLeave,
    panelMode = false,
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

    if (!panelMode && !position) return null;

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
            style={
                panelMode
                    ? {
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        opacity: 1,
                        pointerEvents: "auto",
                    }
                    : {
                        position: "fixed",
                        left: adjustedPos.left,
                        top: adjustedPos.top,
                        width: TOOLTIP_W,
                        zIndex: 9999,
                        opacity: isVisible ? 1 : 0,
                        transform: isVisible
                            ? "translateY(0px) scale(1)"
                            : "translateY(6px) scale(0.97)",
                        transition: "opacity 0.2s ease, transform 0.2s ease",
                        pointerEvents: isVisible ? "auto" : "none",
                    }
            }
            className={
                panelMode
                    ? "relative bg-white h-full overflow-y-auto"
                    : "bg-white border-2 border-gray-300 rounded-xl shadow-xl overflow-hidden"
            }
        >
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg ml-2 text-black">
                        {prefName || `都道府県 ${prefCode}`}
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={downloadPrefZipcodesCSV}
                        disabled={prefZipcodeLoading || !!prefZipcodeError || prefZipcodes.length === 0}
                        className="floppyDisk-button"
                        title="郵便番号CSV出力"
                    >
                        <Download size={24} weight="bold" />
                    </button>

                    {!panelMode && (
                        <button onClick={onClose} className="x-button">
                            <X size={24} weight="bold" />
                        </button>
                    )}
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
                    <div className="flex flex-col gap-4 min-h-[430px]">
                        {(aEff !== null || nEff !== null || hEff !== null || popAggEff !== null || housingAggEff !== null || isAnyLoading) && (
                            <div className="flex flex-col gap-2">
                                <div className="relative group table-details px-3 py-2 rounded-lg">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-gray-700">面積効率：</span>
                                        <span
                                            className={`font-bold ${aEff !== null
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

                                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
                                        <div className="tip1 min-w-[280px]">
                                            <div className="inline-block text-center">
                                                <div className="px-2 pb-1 border-b border-black">
                                                    色付きエリアの人口数 / 総人口数
                                                </div>
                                                <div className="px-2 pt-1">
                                                    色付きエリアの面積 / 総面積
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative group table-details px-3 py-2 rounded-lg">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-gray-700">郵便番号効率：</span>
                                        <span
                                            className={`font-bold ${!zipcodeLoading && nEff !== null
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
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
                                        <div className="tip1 min-w-[310px]">
                                            <div className="inline-block text-center">
                                                <div className="px-2 pb-1 border-b border-black">
                                                    色付きエリアの人口数 / 都道府県総人口数
                                                </div>
                                                <div className="px-2 pt-1">
                                                    色付きエリアの郵便番号数 / 都道府県総郵便番号数
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative group table-details px-3 py-2 rounded-lg">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-gray-700">住宅効率：</span>
                                        <span
                                            className={`font-bold ${!housingLoading && hEff !== null
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

                                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
                                        <div className="tip1 min-w-[310px]">
                                            <div className="inline-block text-center">
                                                <div className="px-2 pb-1 border-b border-black">
                                                    色付きエリアの人口数 / 都道府県総人口数
                                                </div>
                                                <div className="px-2 pt-1">
                                                    色付きエリアの住宅数 / 都道府県総住宅数
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative group table-details px-3 py-2 rounded-lg">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-gray-700">人口集約度：</span>
                                        <span
                                            className={`font-bold ${popAggEff !== null
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
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
                                        <div className="tip1 min-w-[310px]">
                                            <div className="inline-block text-center">
                                                <div className="px-2 pb-1 border-b border-black">
                                                    色付きエリアの人口数 / 色付き面積
                                                </div>
                                                <div className="px-2 pt-1">
                                                    都道府県総人口数 / 都道府県総面積
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative group table-details px-3 py-2 rounded-lg">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-gray-700">住宅集約度：</span>
                                        <span
                                            className={`font-bold ${housingAggEff !== null
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
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
                                        <div className="tip1 min-w-[310px]">
                                            <div className="inline-block text-center">
                                                <div className="px-2 pb-1 border-b border-black">
                                                    色付きエリアの住宅数 / 色付き面積
                                                </div>
                                                <div className="px-2 pt-1">
                                                    都道府県総住宅数 / 都道府県総面積
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <HorizontalRatioBar
                            label="人口"
                            selected={popChartSelected}
                            total={popChartTotal}
                            color="#38bdf8"
                            loading={false}
                            selectedLabel="色付き"
                            totalLabel={popView === 0 ? "県合計" : "全国"}
                            unit="人"
                            view={popView}
                            setView={setPopView}
                            tabBtn={tabBtn}
                        />

                        <HorizontalRatioBar
                            label="郵便番号"
                            selected={zipSelected}
                            total={zipTotal}
                            color="#f97316"
                            loading={zipcodeLoading}
                            selectedLabel="色付き"
                            totalLabel={zipView === 0 ? "県合計" : "全国"}
                            unit="件"
                            view={zipView}
                            setView={setZipView}
                            tabBtn={tabBtn}
                        />

                        <HorizontalRatioBar
                            label="面積"
                            selected={areaChartSelected}
                            total={areaChartTotal}
                            color="#22c55e"
                            loading={false}
                            selectedLabel="色付き"
                            totalLabel={areaView === 0 ? "県合計" : "全国"}
                            unit="ha"
                            view={areaView}
                            setView={setAreaView}
                            tabBtn={tabBtn}
                        />

                        <div className="relative" ref={housingMenuRef}>
                            <HorizontalRatioBar
                                label={`住宅：${housingMetricOptions.find((item) => item.value === housingMetric)?.label || "全住房"}`}
                                selected={housingSelected}
                                total={housingTotal}
                                color="#a855f7"
                                loading={housingLoading}
                                selectedLabel="色付き"
                                totalLabel={housingView === 0 ? "県合計" : "全国"}
                                unit="戸"
                                view={housingView}
                                setView={setHousingView}
                                tabBtn={tabBtn}
                            >
                                <button
                                    type="button"
                                    onClick={() => setHousingMenuOpen((prev) => !prev)}
                                    className="px-2 py-0.5 rounded text-xs font-semibold select-button"
                                >
                                    属性
                                </button>
                            </HorizontalRatioBar>

                            {housingMenuOpen && (
                                <div className="absolute right-0 bottom-full mb-2 z-50 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-1">
                                    {housingMetricOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setHousingMetric(option.value);
                                                setHousingMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-1.5 rounded text-xs ${housingMetric === option.value
                                                ? "bg-sky-100 text-sky-700 font-bold"
                                                : "hover:bg-gray-100 text-gray-700"
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : hasSelection && !housingLoadedOnce && isAnyLoading ? (
                    <div className="table-details min-h-[430px] flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 border-4 border-sky-300 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-500">統計データを読み込み中...</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 min-h-[430px]">
                        <div className="flex flex-col gap-3 min-h-[430px]">
                            <div className="table-details p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-600">総人口：</span>
                                <span className="text-lg font-bold">
                                    {Number(totalPrefPop || 0).toLocaleString()} 人
                                </span>
                            </div>

                            <div className="table-details p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-600">郵便番号：</span>
                                <span className="text-lg font-bold">
                                    {zipcodeLoading
                                        ? "読み込み中..."
                                        : `${Number(prefTotalZipcodes || 0).toLocaleString()} 個`}
                                </span>
                            </div>

                            <div className="table-details p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-600">総面積：</span>
                                <span className="text-lg font-bold">
                                    {Number(totalPrefArea || 0).toLocaleString()} ha
                                </span>
                            </div>

                            <div className="table-details p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-600">住宅総数：</span>
                                <span className="text-lg font-bold">
                                    {housingLoading
                                        ? "読み込み中..."
                                        : `${Number(housingStats?.pref?.totalHousing || 0).toLocaleString()} 戸`}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}