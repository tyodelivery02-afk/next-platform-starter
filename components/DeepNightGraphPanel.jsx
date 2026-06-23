"use client";

import { useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from "recharts";

const DATASET_MASTER = {
    total: { key: "total", label: "総件数" },
    delivered: { key: "delivered", label: "深夜配送" },
    failed: { key: "failed", label: "深夜配送（失敗）" }
};

const CHART_COLORS = [
    "#38bdf8",
    "#facc15",
    "#fb7185",
    "#34d399",
    "#a78bfa",
    "#f97316",
    "#22c55e",
    "#60a5fa",
    "#e879f9",
    "#94a3b8"
];

const SERIES_COLORS = {
    total: "#38bdf8",
    delivered: "#34d399",
    failed: "#fb7185"
};

function toNumber(value) {
    return Number(value || 0);
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function getAutoUnit(maxValue) {
    const value = Math.abs(Number(maxValue || 0));

    if (value >= 1000000) {
        return {
            label: "単位：百万件",
            divider: 1000000
        };
    }

    if (value >= 10000) {
        return {
            label: "単位：万件",
            divider: 10000
        };
    }

    return {
        label: "単位：件",
        divider: 1
    };
}

function formatAxisValue(value, unit) {
    const num = Number(value || 0) / unit.divider;

    if (unit.divider === 1) {
        return formatNumber(num);
    }

    if (num >= 100) return num.toFixed(0);
    if (num >= 10) return num.toFixed(1);

    return num.toFixed(2);
}

function ChartCard({ title, actions, children }) {
    return (
        <div className="table-div bg-white/70">
            <div className="flex justify-between items-center gap-3 mb-3">
                <div className="font-bold text-black">
                    {title}
                </div>

                {actions && actions.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-end">
                        {actions}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}

function NoGraphData() {
    return (
        <div className="table-div p-4 text-sm text-black">
            グラフ表示用データなし
        </div>
    );
}

export default function DeepNightGraphPanel({
    activeTab,
    statTabs,
    timeSlots,
    companyMatrix,
    reasonMatrix,
    driverStats,
    onClose
}) {
    const [chartDatasets, setChartDatasets] = useState({
        companyBar: {
            total: true
        },
        companyLine: {
            total: true
        },
        reasonPie: {
            failed: true
        },
        driverPie: {
            total: true
        }
    });

    const activeLabel = statTabs.find((tab) => tab.key === activeTab)?.label || "";

    const driverDatasetAvailability = useMemo(() => {
        const hasDelivered = (driverStats || []).some((row) =>
            toNumber(row.delivered_count ?? row.delivered_total_count ?? row.delivered_rows) > 0
        );

        const hasFailed = (driverStats || []).some((row) =>
            toNumber(row.failed_count ?? row.failed_total_count ?? row.failed_rows) > 0
        );

        return {
            total: true,
            delivered: hasDelivered,
            failed: hasFailed
        };
    }, [driverStats]);

    const getChartDatasetOptions = (chartKey) => {
        if (chartKey === "companyBar" || chartKey === "companyLine") {
            return [
                DATASET_MASTER.total,
                DATASET_MASTER.delivered,
                DATASET_MASTER.failed
            ];
        }

        if (chartKey === "reasonPie") {
            return [
                DATASET_MASTER.failed
            ];
        }

        if (chartKey === "driverPie") {
            const options = [DATASET_MASTER.total];

            if (driverDatasetAvailability.delivered) {
                options.push(DATASET_MASTER.delivered);
            }

            if (driverDatasetAvailability.failed) {
                options.push(DATASET_MASTER.failed);
            }

            return options;
        }

        return [];
    };

    const getActiveDatasets = (chartKey) => {
        const options = getChartDatasetOptions(chartKey);
        const selectedMap = chartDatasets[chartKey] || {};
        const selected = options.filter((item) => selectedMap[item.key]);

        if (selected.length > 0) {
            return selected;
        }

        return options.slice(0, 1);
    };

    const toggleDataset = (chartKey, datasetKey) => {
        const options = getChartDatasetOptions(chartKey);

        if (!options.some((item) => item.key === datasetKey)) {
            return;
        }

        const activeDatasets = getActiveDatasets(chartKey);
        const isActive = activeDatasets.some((item) => item.key === datasetKey);

        if (isActive && activeDatasets.length <= 1) {
            return;
        }

        setChartDatasets((prev) => {
            const current = prev[chartKey] || {};

            return {
                ...prev,
                [chartKey]: {
                    ...current,
                    [datasetKey]: !current[datasetKey]
                }
            };
        });
    };

    const renderDatasetButtons = (chartKey) => {
        const options = getChartDatasetOptions(chartKey);
        const activeDatasets = getActiveDatasets(chartKey);
        const activeKeys = new Set(activeDatasets.map((item) => item.key));

        return options.map((item) => {
            const active = activeKeys.has(item.key);
            const cannotTurnOff = active && activeDatasets.length <= 1;

            return (
                <button
                    key={`${chartKey}-dataset-${item.key}`}
                    type="button"
                    disabled={cannotTurnOff}
                    onClick={() => toggleDataset(chartKey, item.key)}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all duration-300 ${active
                            ? cannotTurnOff
                                ? "bg-sky-400 text-white shadow-md cursor-not-allowed"
                                : "bg-sky-400 text-white shadow-md hover:shadow-yellow-400"
                            : "select-button opacity-60"
                        }`}
                >
                    {item.label}
                </button>
            );
        });
    };

    const companyBarData = useMemo(() => {
        return (companyMatrix?.companies || [])
            .map((company) => {
                const delivered = toNumber(company.totalDelivered);
                const failed = toNumber(company.totalFailed);

                return {
                    company: company.company,
                    total: delivered + failed,
                    delivered,
                    failed
                };
            })
            .filter((item) => item.total > 0 || item.delivered > 0 || item.failed > 0)
            .sort((a, b) => b.total - a.total);
    }, [companyMatrix?.companies]);

    const companyTimeData = useMemo(() => {
        return timeSlots.map((slot) => {
            const row = companyMatrix?.totalsByHour?.[slot.hour] || {};
            const delivered = toNumber(row.delivered);
            const failed = toNumber(row.failed);

            return {
                time: slot.label,
                total: delivered + failed,
                delivered,
                failed
            };
        });
    }, [companyMatrix?.totalsByHour, timeSlots]);

    const reasonPieDataMap = useMemo(() => {
        const data = (reasonMatrix?.reasons || [])
            .map((reason) => {
                const value = (reasonMatrix?.companies || []).reduce((companySum, company) => {
                    const reasonTotal = timeSlots.reduce((slotSum, slot) => {
                        const key = `${slot.hour}__${reason}`;
                        return slotSum + toNumber(company.byHourReason?.[key]);
                    }, 0);

                    return companySum + reasonTotal;
                }, 0);

                return {
                    name: reason,
                    value
                };
            })
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value);

        return {
            failed: data
        };
    }, [reasonMatrix?.reasons, reasonMatrix?.companies, timeSlots]);

    const driverPieDataMap = useMemo(() => {
        const buildData = (key) => {
            return [...(driverStats || [])]
                .map((row) => {
                    let value = 0;

                    if (key === "total") {
                        value = toNumber(row.total_count);
                    }

                    if (key === "delivered") {
                        value = toNumber(row.delivered_count ?? row.delivered_total_count ?? row.delivered_rows);
                    }

                    if (key === "failed") {
                        value = toNumber(row.failed_count ?? row.failed_total_count ?? row.failed_rows);
                    }

                    return {
                        name: `${row.driver_name || "未設定"}（${row.delivery_company || "未設定"}）`,
                        value
                    };
                })
                .filter((item) => item.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
        };

        return {
            total: buildData("total"),
            delivered: buildData("delivered"),
            failed: buildData("failed")
        };
    }, [driverStats]);

    const companyBarActiveDatasets = getActiveDatasets("companyBar");
    const companyLineActiveDatasets = getActiveDatasets("companyLine");
    const reasonPieActiveDatasets = getActiveDatasets("reasonPie");
    const driverPieActiveDatasets = getActiveDatasets("driverPie");

    const maxCompanyBarValue = Math.max(
        ...companyBarData.flatMap((item) =>
            companyBarActiveDatasets.map((dataset) => toNumber(item[dataset.key]))
        ),
        0
    );

    const maxCompanyTimeValue = Math.max(
        ...companyTimeData.flatMap((item) =>
            companyLineActiveDatasets.map((dataset) => toNumber(item[dataset.key]))
        ),
        0
    );

    const companyBarUnit = getAutoUnit(maxCompanyBarValue);
    const companyTimeUnit = getAutoUnit(maxCompanyTimeValue);

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                    <h3 className="text-xl font-bold text-black">
                        グラフ
                    </h3>

                    <div className="text-sm text-gray-600">
                        {activeLabel}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="clear-button"
                >
                    閉じる
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                {activeTab === "company" && (
                    <>
                        {companyBarData.length === 0 ? (
                            <NoGraphData />
                        ) : (
                            <ChartCard
                                title="業者別 件数"
                                actions={renderDatasetButtons("companyBar")}
                            >
                                <div style={{ height: Math.max(280, Math.min(520, companyBarData.length * 34 + 80)) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={companyBarData}
                                            layout="vertical"
                                            barCategoryGap="22%"
                                            barGap={2}
                                            margin={{ top: 10, right: 25, left: 70, bottom: 28 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />

                                            <XAxis
                                                type="number"
                                                tickFormatter={(value) => formatAxisValue(value, companyBarUnit)}
                                                label={{
                                                    value: companyBarUnit.label,
                                                    position: "insideBottom",
                                                    offset: -10
                                                }}
                                            />

                                            <YAxis
                                                type="category"
                                                dataKey="company"
                                                width={120}
                                                tick={{ fontSize: 11 }}
                                            />

                                            <Tooltip formatter={(value) => `${formatNumber(value)}件`} />
                                            <Legend />

                                            {companyBarActiveDatasets.map((dataset) => (
                                                <Bar
                                                    key={`company-bar-${dataset.key}`}
                                                    dataKey={dataset.key}
                                                    name={dataset.label}
                                                    fill={SERIES_COLORS[dataset.key]}
                                                    barSize={12}
                                                />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        )}

                        {companyTimeData.every((item) =>
                            companyLineActiveDatasets.every((dataset) => toNumber(item[dataset.key]) === 0)
                        ) ? (
                            <NoGraphData />
                        ) : (
                            <ChartCard
                                title="時間帯別 推移"
                                actions={renderDatasetButtons("companyLine")}
                            >
                                <div className="h-[320px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={companyTimeData}
                                            margin={{ top: 10, right: 25, left: 10, bottom: 10 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="time" />

                                            <YAxis
                                                tickFormatter={(value) => formatAxisValue(value, companyTimeUnit)}
                                                label={{
                                                    value: companyTimeUnit.label,
                                                    angle: -90,
                                                    position: "insideLeft"
                                                }}
                                            />

                                            <Tooltip formatter={(value) => `${formatNumber(value)}件`} />
                                            <Legend />

                                            {companyLineActiveDatasets.map((dataset) => (
                                                <Line
                                                    key={`company-line-${dataset.key}`}
                                                    type="monotone"
                                                    dataKey={dataset.key}
                                                    name={dataset.label}
                                                    stroke={SERIES_COLORS[dataset.key]}
                                                    strokeWidth={3}
                                                    dot={{ r: 3 }}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        )}
                    </>
                )}

                {activeTab === "reason" && (
                    <ChartCard
                        title="失敗原因別 占比"
                        actions={renderDatasetButtons("reasonPie")}
                    >
                        <div className="space-y-5">
                            {reasonPieActiveDatasets.map((dataset) => {
                                const pieData = reasonPieDataMap[dataset.key] || [];

                                if (pieData.length === 0) {
                                    return null;
                                }

                                return (
                                    <div
                                        key={`reason-pie-${dataset.key}`}
                                        className="h-[380px]"
                                    >
                                        <div className="text-sm font-semibold text-black mb-2">
                                            {dataset.label}
                                        </div>

                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={115}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell
                                                            key={`reason-pie-cell-${dataset.key}-${entry.name}-${index}`}
                                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>

                                                <Tooltip formatter={(value) => `${formatNumber(value)}件`} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                );
                            })}

                            {reasonPieActiveDatasets.every((dataset) => {
                                const pieData = reasonPieDataMap[dataset.key] || [];
                                return pieData.length === 0;
                            }) && <NoGraphData />}
                        </div>
                    </ChartCard>
                )}

                {activeTab === "driver" && (
                    <ChartCard
                        title="配達員別 TOP5 占比"
                        actions={renderDatasetButtons("driverPie")}
                    >
                        <div className="space-y-5">
                            {driverPieActiveDatasets.map((dataset) => {
                                const pieData = driverPieDataMap[dataset.key] || [];

                                if (pieData.length === 0) {
                                    return null;
                                }

                                return (
                                    <div
                                        key={`driver-pie-${dataset.key}`}
                                        className="h-[380px]"
                                    >
                                        <div className="text-sm font-semibold text-black mb-2">
                                            {dataset.label}
                                        </div>

                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={115}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell
                                                            key={`driver-pie-cell-${dataset.key}-${entry.name}-${index}`}
                                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>

                                                <Tooltip formatter={(value) => `${formatNumber(value)}件`} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                );
                            })}

                            {driverPieActiveDatasets.every((dataset) => {
                                const pieData = driverPieDataMap[dataset.key] || [];
                                return pieData.length === 0;
                            }) && <NoGraphData />}
                        </div>
                    </ChartCard>
                )}
            </div>
        </div>
    );
}