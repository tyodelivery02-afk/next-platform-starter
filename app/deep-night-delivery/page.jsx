"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import AlertModal from "components/alert";
import WarningModal from "components/warning";
import LoadingModal from "components/loading";
import * as XLSX from "xlsx";
import DeepNightGraphPanel from "components/DeepNightGraphPanel";

const importScreens = [
    { label: "深夜配達", href: "/deep-night-delivery" },
    { label: "通常配達", href: "/delivery-import" },
    { label: "誤配", href: "/misdelivery-import" }
];

const statTabs = [
    { key: "company", label: "業者別" },
    { key: "driver", label: "配達員別" },
    { key: "reason", label: "失敗原因別" }
];

const timeSlots = [
    { key: "h22", hour: 22, label: "22時台" },
    { key: "h23", hour: 23, label: "23時台" },
    { key: "h0", hour: 0, label: "0時台" },
    { key: "h1", hour: 1, label: "1時台" },
    { key: "h2", hour: 2, label: "2時台" },
    { key: "h3", hour: 3, label: "3時台" },
    { key: "h4", hour: 4, label: "4時台" },
    { key: "h5", hour: 5, label: "5時台" },
    { key: "h6", hour: 6, label: "6時台" },
    { key: "h7", hour: 7, label: "7時台" }
];

const COMPANY_CHUNK_SIZE = 5;
const REASON_CHUNK_SIZE = 5;

const IMPORT_CHUNK_SIZE = 5000;

function sleep(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasImportData(row) {
    if (!Array.isArray(row)) return false;

    for (let i = 0; i <= 26; i++) {
        if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== "") {
            return true;
        }
    }

    return false;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatPeriod(summary) {
    if (!summary?.start_date && !summary?.end_date) return "";

    if (summary.start_date === summary.end_date) {
        return summary.start_date;
    }

    return `${summary.start_date || ""}〜${summary.end_date || ""}`;
}

function chunkArray(array, size) {
    const result = [];

    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }

    return result;
}

function getSoftBg(index) {
    return index % 2 === 0 ? "bg-sky-50" : "bg-yellow-50";
}

export default function DeepNightDeliveryPage() {
    const alertRef = useRef();
    const warningRef = useRef();
    const fileInputRef = useRef();
    const [searchStartDate, setSearchStartDate] = useState("");
    const [searchEndDate, setSearchEndDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Loading...");
    const [activeTab, setActiveTab] = useState("company");
    const [showGraphPanel, setShowGraphPanel] = useState(false);
    const [hoveredCompanyKey, setHoveredCompanyKey] = useState("");
    const [stats, setStats] = useState({
        summary: {},
        companyStats: [],
        driverStats: [],
        failureReasonStats: []
    });

    useEffect(() => {
        loadStats("", "", true);
    }, []);

    const loadStats = async (startDate = "", endDate = "", shouldSyncRange = false) => {
        setLoading(true);
        setLoadingMessage("Loading...");

        try {
            const params = new URLSearchParams();

            if (startDate) {
                params.set("startDate", startDate);
            }

            if (endDate) {
                params.set("endDate", endDate);
            }

            const query = params.toString();
            const url = query
                ? `/api/deep-night-delivery?${query}`
                : "/api/deep-night-delivery";

            const res = await fetch(url, {
                cache: "no-store"
            });

            const contentType = res.headers.get("content-type") || "";
            const responseText = await res.text();

            if (!contentType.includes("application/json")) {
                console.error("API returned non-JSON response:", responseText);
                throw new Error("APIがJSONではなくHTMLを返しました。サーバー側でエラーが発生しています。");
            }

            const result = JSON.parse(responseText);

            if (!res.ok || !result.success) {
                throw new Error(result.error || "データ取得失敗");
            }

            const nextSummary = result.summary || {};

            setStats({
                summary: nextSummary,
                companyStats: result.companyStats || [],
                driverStats: result.driverStats || [],
                failureReasonStats: result.failureReasonStats || []
            });

            if (shouldSyncRange) {
                setSearchStartDate(nextSummary.selected_start_date || nextSummary.default_start_date || "");
                setSearchEndDate(nextSummary.selected_end_date || nextSummary.default_end_date || "");
            }
        } catch (error) {
            console.error(error);
            warningRef.current?.open({ message: "データの取得に失敗しました" });
        } finally {
            setLoading(false);
        }
    };

    const handlePeriodChange = (field, value) => {
        const nextStartDate = field === "start" ? value : searchStartDate;
        const nextEndDate = field === "end" ? value : searchEndDate;

        setSearchStartDate(nextStartDate);
        setSearchEndDate(nextEndDate);

        loadStats(nextStartDate, nextEndDate, false);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];

        if (!file) return;

        const startedAt = performance.now();

        setLoading(true);
        setLoadingMessage("Reading Excel...");

        try {
            const arrayBuffer = await file.arrayBuffer();

            const workbook = XLSX.read(arrayBuffer, {
                type: "array",
                cellDates: false,
                dense: true
            });

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: null,
                raw: true,
                blankrows: false
            });

            if (!rows || rows.length <= 1) {
                throw new Error("取込対象データがありません");
            }

            const dataRows = rows.slice(1).filter(hasImportData);
            const totalRows = dataRows.length;

            if (totalRows === 0) {
                throw new Error("取込対象データがありません");
            }

            let importedCount = 0;
            let skippedCount = 0;

            const importSessionId =
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            const chunksTotal = Math.ceil(totalRows / IMPORT_CHUNK_SIZE);

            for (let start = 0; start < totalRows; start += IMPORT_CHUNK_SIZE) {
                const chunkIndex = Math.floor(start / IMPORT_CHUNK_SIZE) + 1;
                const chunk = dataRows.slice(start, start + IMPORT_CHUNK_SIZE);
                const currentEnd = Math.min(start + chunk.length, totalRows);
                const isLastChunk = currentEnd >= totalRows;

                setLoadingMessage(`Importing... ${formatNumber(currentEnd)} / ${formatNumber(totalRows)}`);

                const res = await fetch("/api/deep-night-delivery", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        rows: chunk,
                        importSessionId,
                        fileName: file.name,
                        sourceTotalRows: totalRows,
                        chunkIndex,
                        chunksTotal,
                        isLastChunk
                    })
                });

                let result = null;

                try {
                    result = await res.json();
                } catch {
                    throw new Error("サーバー応答の解析に失敗しました");
                }

                if (!res.ok || !result.success) {
                    throw new Error(result?.error || "インポート失敗");
                }

                importedCount += Number(result.insertedCount || result.count || 0);
                skippedCount += Number(result.skippedCount || 0);

                await sleep(0);
            }

            const elapsedSec = ((performance.now() - startedAt) / 1000).toFixed(1);

            alertRef.current?.open({
                message: `${elapsedSec}秒で${formatNumber(importedCount)}件 インポート成功`
            });

            await loadStats("", "", true);
        } catch (error) {
            console.error(error);
            warningRef.current?.open({
                message: error?.message || "インポートに失敗しました"
            });
        } finally {
            event.target.value = "";
            setLoading(false);
        }
    };

    const companyMatrix = useMemo(() => {
        const map = new Map();

        stats.companyStats.forEach((row) => {
            const company = row.delivery_company || "未設定";
            const hour = Number(row.hour_value);

            if (!map.has(company)) {
                map.set(company, {
                    company,
                    totalDelivered: 0,
                    totalFailed: 0,
                    byHour: {}
                });
            }

            const item = map.get(company);
            const delivered = Number(row.delivered_count || 0);
            const failed = Number(row.failed_count || 0);

            item.totalDelivered += delivered;
            item.totalFailed += failed;
            item.byHour[hour] = {
                delivered,
                failed
            };
        });

        const companies = Array.from(map.values()).sort((a, b) => {
            const totalA = a.totalDelivered + a.totalFailed;
            const totalB = b.totalDelivered + b.totalFailed;

            return totalB - totalA;
        });

        const totalsByHour = {};

        timeSlots.forEach((slot) => {
            totalsByHour[slot.hour] = {
                delivered: companies.reduce(
                    (sum, company) => sum + Number(company.byHour[slot.hour]?.delivered || 0),
                    0
                ),
                failed: companies.reduce(
                    (sum, company) => sum + Number(company.byHour[slot.hour]?.failed || 0),
                    0
                )
            };
        });

        return {
            companies,
            companyChunks: chunkArray(companies, COMPANY_CHUNK_SIZE),
            totalsByHour,
            totalDelivered: companies.reduce((sum, item) => sum + item.totalDelivered, 0),
            totalFailed: companies.reduce((sum, item) => sum + item.totalFailed, 0)
        };
    }, [stats.companyStats]);

    const reasonMatrix = useMemo(() => {
        const companyMap = new Map();
        const reasonSet = new Set();

        stats.failureReasonStats.forEach((row) => {
            const company = row.delivery_company || "未設定";
            const reason = row.failure_reason || "未設定";
            const hour = Number(row.hour_value);
            const count = Number(row.count || 0);

            reasonSet.add(reason);

            if (!companyMap.has(company)) {
                companyMap.set(company, {
                    company,
                    total: 0,
                    byHourReason: {}
                });
            }

            const companyData = companyMap.get(company);
            const key = `${hour}__${reason}`;

            companyData.total += count;
            companyData.byHourReason[key] = (companyData.byHourReason[key] || 0) + count;
        });

        const reasons = Array.from(reasonSet).sort((a, b) => a.localeCompare(b, "ja"));
        const companies = Array.from(companyMap.values()).sort((a, b) => {
            return b.total - a.total;
        });

        return {
            reasons,
            reasonChunks: chunkArray(reasons, REASON_CHUNK_SIZE),
            companies
        };
    }, [stats.failureReasonStats]);

    const renderCompanyView = () => {
        if (companyMatrix.companies.length === 0) {
            return <div className="table-div p-4 text-sm text-black">データなし</div>;
        }

        return (
            <div className="table-div">
                <table className="w-full border-collapse text-black text-sm">
                    <thead>
                        <tr className="table-title text-center">
                            <th className="table-title border border-sky-300 px-1 py-1 text-center font-bold whitespace-normal break-words leading-tight w-[120px]">
                                業者
                            </th>

                            <th className="table-title border border-sky-300 px-1 py-1 text-center font-bold whitespace-nowrap w-[54px]">
                                区分
                            </th>

                            <th className="table-title border border-sky-300 px-1 py-1 text-center font-bold whitespace-nowrap">
                                総件数
                            </th>

                            {timeSlots.map((slot) => (
                                <th
                                    key={`company-time-head-${slot.hour}`}
                                    className="table-title border border-sky-300 px-1 py-1 text-center font-bold whitespace-nowrap"
                                >
                                    {slot.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>

                        {companyMatrix.companies.map((company, companyIndex) => {
                            const hoverKey = `company-${companyIndex}-${company.company}`;

                            return (
                                <Fragment key={`company-row-group-${companyIndex}-${company.company}`}>
                                    <tr
                                        className="table-hover"
                                        onMouseEnter={() => setHoveredCompanyKey(hoverKey)}
                                        onMouseLeave={() => setHoveredCompanyKey("")}
                                    >
                                        <td
                                            rowSpan={2}
                                            className={`border border-white px-1 py-1 text-center font-semibold whitespace-normal break-words leading-tight transition-all duration-300 ${hoveredCompanyKey === hoverKey ? "bg-yellow-200" : ""
                                                }`}
                                        >
                                            <span title={company.company}>{company.company}</span>
                                        </td>

                                        <td className="border border-white px-1 py-1 text-center font-semibold whitespace-nowrap">
                                            配達
                                        </td>

                                        <td className="border border-white px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                            {formatNumber(company.totalDelivered)}
                                        </td>

                                        {timeSlots.map((slot) => {
                                            const row = company.byHour[slot.hour] || {};

                                            return (
                                                <td
                                                    key={`company-delivered-${companyIndex}-${company.company}-${slot.hour}`}
                                                    className="border border-white px-1 py-1 text-right tabular-nums whitespace-nowrap"
                                                >
                                                    {formatNumber(row.delivered)}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    <tr
                                        className="table-hover"
                                        onMouseEnter={() => setHoveredCompanyKey(hoverKey)}
                                        onMouseLeave={() => setHoveredCompanyKey("")}
                                    >
                                        <td className="border border-white px-1 py-1 text-center font-semibold whitespace-nowrap">
                                            失敗
                                        </td>

                                        <td className="border border-white px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                            {formatNumber(company.totalFailed)}
                                        </td>

                                        {timeSlots.map((slot) => {
                                            const row = company.byHour[slot.hour] || {};

                                            return (
                                                <td
                                                    key={`company-failed-${companyIndex}-${company.company}-${slot.hour}`}
                                                    className="border border-white px-1 py-1 text-right tabular-nums whitespace-nowrap"
                                                >
                                                    {formatNumber(row.failed)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderDriverView = () => {
        if (stats.driverStats.length === 0) {
            return <div className="table-div p-4 text-sm text-black">データなし</div>;
        }

        return (
            <div className="table-div">
                <table className="w-full border-collapse text-black text-sm">
                    <thead>
                        <tr className="table-title text-center">
                            <th className="table-title border border-sky-300 px-3 py-2 text-center font-bold whitespace-nowrap overflow-hidden text-ellipsis w-[15%]">
                                業者
                            </th>
                            <th className="table-title border border-sky-300 px-3 py-2 text-center font-bold whitespace-nowrap overflow-hidden text-ellipsis w-[18%]">
                                配達員
                            </th>

                            {timeSlots.map((slot) => (
                                <th
                                    key={`driver-head-${slot.key}`}
                                    className="table-title border border-sky-300 px-3 py-2 text-center font-bold whitespace-nowrap overflow-hidden text-ellipsis"
                                >
                                    {slot.label}
                                </th>
                            ))}

                            <th className="table-title border border-sky-300 px-3 py-2 text-center font-bold whitespace-nowrap overflow-hidden text-ellipsis w-[9%]">
                                総件数
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {stats.driverStats.map((row, index) => (
                            <tr
                                key={`driver-row-${row.delivery_company}-${row.driver_name}-${index}`}
                                className="table-hover"
                            >
                                <td className="border border-white px-3 py-2 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                                    {row.delivery_company}
                                </td>
                                <td className="border border-white px-3 py-2 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                                    {row.driver_name}
                                </td>

                                {timeSlots.map((slot) => (
                                    <td
                                        key={`driver-body-${row.delivery_company}-${row.driver_name}-${index}-${slot.key}`}
                                        className="border border-white px-3 py-2 text-right tabular-nums whitespace-nowrap"
                                    >
                                        {formatNumber(row[slot.key])}
                                    </td>
                                ))}

                                <td className="border border-white px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                    {formatNumber(row.total_count)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderReasonView = () => {
        if (reasonMatrix.companies.length === 0 || reasonMatrix.reasons.length === 0) {
            return <div className="table-div p-4 text-sm text-black">データなし</div>;
        }

        return (
            <div className="space-y-5">
                {reasonMatrix.reasonChunks.map((reasonChunk, reasonChunkIndex) => (
                    <div key={`reason-chunk-${reasonChunkIndex}`} className="table-div">
                        <table className="w-full border-collapse text-black text-sm">
                            <thead>
                                <tr className="table-title text-center">
                                    <th className="table-title border border-sky-300 px-3 py-2 text-center font-bold whitespace-nowrap overflow-hidden text-ellipsis w-[15%]">
                                        業者
                                    </th>

                                    <th className="table-title border border-sky-300 px-3 py-2 text-center font-bold whitespace-nowrap overflow-hidden text-ellipsis w-20">
                                        時間帯
                                    </th>

                                    {reasonChunk.map((reason, reasonIndex) => (
                                        <th
                                            key={`reason-head-${reasonChunkIndex}-${reasonIndex}-${reason}`}
                                            className="table-title border border-sky-300 px-3 py-2 text-center font-bold whitespace-nowrap overflow-hidden text-ellipsis"
                                        >
                                            <span title={reason}>{reason}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                <tr className="font-bold bg-yellow-50">
                                    <td className="border border-white px-3 py-2 text-center font-semibold whitespace-normal break-words bg-yellow-50">
                                        全業者
                                    </td>

                                    <td className="border border-white px-3 py-2 text-center font-semibold whitespace-nowrap overflow-hidden text-ellipsis bg-yellow-50">
                                        全時間帯
                                    </td>

                                    {reasonChunk.map((reason, reasonIndex) => {
                                        const grandTotal = reasonMatrix.companies.reduce((companySum, company) => {
                                            const reasonTotal = timeSlots.reduce((slotSum, slot) => {
                                                const key = `${slot.hour}__${reason}`;
                                                return slotSum + Number(company.byHourReason[key] || 0);
                                            }, 0);

                                            return companySum + reasonTotal;
                                        }, 0);

                                        return (
                                            <td
                                                key={`reason-grand-total-${reasonChunkIndex}-${reasonIndex}-${reason}`}
                                                className="border border-white px-3 py-2 text-right tabular-nums whitespace-nowrap bg-yellow-50"
                                            >
                                                {formatNumber(grandTotal)}
                                            </td>
                                        );
                                    })}
                                </tr>
                                {reasonMatrix.companies.map((company, companyIndex) => {
                                    const hoverKey = `reason-company-${reasonChunkIndex}-${companyIndex}-${company.company}`;

                                    return (
                                        <Fragment key={`reason-company-${reasonChunkIndex}-${companyIndex}-${company.company}`}>
                                            <tr
                                                key={`reason-total-${reasonChunkIndex}-${companyIndex}-${company.company}`}
                                                className="table-hover font-bold bg-yellow-50"
                                                onMouseEnter={() => setHoveredCompanyKey(hoverKey)}
                                                onMouseLeave={() => setHoveredCompanyKey("")}
                                            >
                                                <td
                                                    rowSpan={timeSlots.length + 1}
                                                    className={`table-style1 border border-white px-3 py-2 text-center font-semibold whitespace-normal break-words transition-all duration-300 ${hoveredCompanyKey === hoverKey ? "bg-yellow-200" : ""
                                                        }`}
                                                >
                                                    {company.company}
                                                </td>

                                                <td className="border border-white px-3 py-2 text-center font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                                                    全時間帯
                                                </td>

                                                {reasonChunk.map((reason, reasonIndex) => {
                                                    const total = timeSlots.reduce((sum, slot) => {
                                                        const key = `${slot.hour}__${reason}`;
                                                        return sum + Number(company.byHourReason[key] || 0);
                                                    }, 0);

                                                    return (
                                                        <td
                                                            key={`reason-total-cell-${reasonChunkIndex}-${companyIndex}-${reasonIndex}-${reason}`}
                                                            className="border border-white px-3 py-2 text-right tabular-nums whitespace-nowrap"
                                                        >
                                                            {formatNumber(total)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>

                                            {timeSlots.map((slot) => (
                                                <tr
                                                    key={`reason-row-${reasonChunkIndex}-${companyIndex}-${company.company}-${slot.hour}`}
                                                    className="table-hover"
                                                    onMouseEnter={() => setHoveredCompanyKey(hoverKey)}
                                                    onMouseLeave={() => setHoveredCompanyKey("")}
                                                >
                                                    <td className="border border-white px-3 py-2 text-center font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                                                        {slot.label}
                                                    </td>

                                                    {reasonChunk.map((reason, reasonIndex) => {
                                                        const key = `${slot.hour}__${reason}`;

                                                        return (
                                                            <td
                                                                key={`reason-body-${reasonChunkIndex}-${companyIndex}-${slot.hour}-${reasonIndex}-${reason}`}
                                                                className="border border-white px-3 py-2 text-right tabular-nums whitespace-nowrap"
                                                            >
                                                                {formatNumber(company.byHourReason[key])}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-style">
            <div className="flex gap-4 items-start transition-all duration-300">
                <div
                    className={`transition-all duration-300 min-w-0 ${showGraphPanel ? "w-1/2" : "w-full"
                        }`}
                >
                    <div className="flex items-center gap-10 mb-6">
                        <h2 className="relative text-x2 font-bold text-black text-shadow">
                            深夜配達
                        </h2>

                        <div className="flex gap-2 flex-wrap justify-end">
                            {importScreens.map((screen) => (
                                <Link
                                    key={`import-screen-${screen.href}`}
                                    href={screen.href}
                                    className={`px-4 py-2 rounded-lg no-underline transition-all duration-300 ${screen.href === "/deep-night-delivery"
                                        ? "bg-sky-400 text-white font-semibold shadow-md hover:shadow-yellow-400"
                                        : "select-button"
                                        }`}
                                >
                                    {screen.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                        <div className="table-div-yellow text-center min-h-[76px] flex flex-col justify-center p-3">
                            <div className="font-bold text-black mb-1">対象期間</div>

                            <div className="flex items-center justify-center gap-2">
                                <input
                                    type="date"
                                    value={searchStartDate}
                                    onChange={(e) => handlePeriodChange("start", e.target.value)}
                                    className="input-item w-[135px] px-2 py-1 text-xs"
                                />

                                <span className="text-sm font-bold">〜</span>

                                <input
                                    type="date"
                                    value={searchEndDate}
                                    onChange={(e) => handlePeriodChange("end", e.target.value)}
                                    className="input-item w-[135px] px-2 py-1 text-xs"
                                />
                            </div>
                        </div>

                        <div className="table-div-yellow text-center min-h-[76px] flex flex-col justify-center p-3">
                            <div className="font-bold text-black mb-1">総件数</div>
                            <div className="text-xl font-bold text-black">{formatNumber(stats.summary.total_rows)}</div>
                        </div>

                        <div className="table-div-yellow text-center min-h-[76px] flex flex-col justify-center p-3">
                            <div className="font-bold text-black mb-1">配達件数</div>
                            <div className="text-xl font-bold text-black">{formatNumber(stats.summary.delivered_rows)}</div>
                        </div>

                        <div className="table-div-yellow text-center min-h-[76px] flex flex-col justify-center p-3">
                            <div className="font-bold text-black mb-1">失敗件数</div>
                            <div className="text-xl font-bold text-black">{formatNumber(stats.summary.failed_rows)}</div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-6 mb-4">
                        <div className="flex gap-2 flex-wrap">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleFileChange}
                            />

                            <button type="button" onClick={handleImportClick} className="orther-button">
                                インポート
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowGraphPanel((prev) => !prev)}
                                className={showGraphPanel ? "select-button" : "orther-button"}
                            >
                                グラフ
                            </button>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {statTabs.map((tab) => (
                                <button
                                    key={`stat-tab-${tab.key}`}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-4 py-2 rounded-lg transition-all duration-300 font-semibold shadow-md hover:shadow-yellow-400 ${activeTab === tab.key
                                        ? "bg-sky-400 text-white"
                                        : "select-button"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === "company" && renderCompanyView()}
                    {activeTab === "driver" && renderDriverView()}
                    {activeTab === "reason" && renderReasonView()}
                </div>

                <div
                    className={`transition-all duration-300 overflow-hidden ${showGraphPanel
                            ? "w-1/2 opacity-100"
                            : "w-0 opacity-0"
                        }`}
                >
                    {showGraphPanel && (
                        <div className="h-[calc(100vh-4rem)] sticky top-8 table-div overflow-hidden">
                            <DeepNightGraphPanel
                                activeTab={activeTab}
                                statTabs={statTabs}
                                timeSlots={timeSlots}
                                companyMatrix={companyMatrix}
                                reasonMatrix={reasonMatrix}
                                driverStats={stats.driverStats}
                                onClose={() => setShowGraphPanel(false)}
                            />
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