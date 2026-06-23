"use client";

import { useEffect, useState } from "react";
import LoadingModal from "components/loading";
import { X } from "phosphor-react";

export default function MonitorPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState("Loading...");
    const [itemPage, setItemPage] = useState(1);
    const [itemTotal, setItemTotal] = useState(0);
    const [selectedSource, setSelectedSource] = useState("all");

    async function loadList(page = itemPage, source = selectedSource) {
        const query = new URLSearchParams({
            page: String(page),
        });

        if (source !== "all") {
            query.set("source", source);
        }

        const res = await fetch(`/api/monitor/list?${query.toString()}`);
        const data = await res.json();

        setItems(data.items || []);
        setItemTotal(data.total || 0);
    }

    useEffect(() => {
        loadList(itemPage, selectedSource);
    }, [itemPage, selectedSource]);

    function handleSourceChange(e) {
        const nextSource = e.target.value;
        setSelectedSource(nextSource);
        setItemPage(1);
    }

    async function runCollectOnce() {
        try {
            setLoading(true);
            setLoadingMessage("Executing...");
            setResult(null);

            const res = await fetch("/api/monitor/collect", {
                method: "POST"
            });

            const data = await res.json();

            if (!res.ok) {
                setResult({
                    type: "error",
                    message: data.error || "执行失败",
                    details: data.details
                });
                return;
            }

            setResult({
                type: data.hasErrors ? "warning" : "success",
                summary: data.summary,
                errors: data.details?.errors || []
            });

            await loadList(1);
            setItemPage(1);
        } catch (e) {
            setResult({
                type: "error",
                message: e.message || "执行失败"
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-style">

            {/* 操作栏 */}
            <div className="mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={runCollectOnce}
                        disabled={loading}
                        className="orther-button"
                    >
                        エゴサ
                    </button>

                    <select
                        value={selectedSource}
                        onChange={handleSourceChange}
                        className="px-3 py-2 select-button"
                    >
                        <option value="all">すべて</option>
                        <option value="google-search">Google Search</option>
                        <option value="google-news-jp">Google News</option>
                        <option value="yahoo-japan">Yahoo! Japan</option>
                        <option value="twitter">X</option>
                        <option value="bluesky">Bluesky</option>
                        <option value="youtube">YouTube</option>
                        <option value="5ch">5ch</option>
                        <option value="note">note</option>
                    </select>

                    {itemTotal} 件記事
                    <div className="flex flex-col mr-30 ml-auto">
                        <p className="font-medium text-red-500 bg-yellow-200">2026年2月7日の新規定によりX（旧Twitter）の無料枠が廃止されたため、今後はXでのエゴサを停止いたします。</p>
                        <p className="font-medium">-------------------------------------------</p>
                        <p className="text-xl font-medium">je ne vois que d’un point, mais dans mon existence je suis regardé de partout.</p>
                        <p className="font-medium">- I see only from one point, but in my existence I am looked from everywhere. -</p>
                    </div>
                </div>

                {/* 执行结果 */}
                {result && (
                    <div
                        className="relative mt-4 p-4 pr-10 rounded bg-yellow-50 border border-yellow-200"
                    >
                        {/* 关闭按钮 */}
                        <button
                            onClick={() => setResult(null)}
                            className="absolute top-2 right-3 x-button"
                            aria-label="閉じる"
                        >
                            <X size={20} weight="bold" />
                        </button>

                        {result.summary && (
                            <p className="font-semibold">
                                {result.summary.total} 件の新しい記事が入りました
                            </p>
                        )}

                        {result.message && (
                            <p className="text-red-600">{result.message}</p>
                        )}

                        {result.errors && result.errors.length > 0 && (
                            <div className="mt-2">
                                <ul className="text-xs space-y-1">
                                    {result.errors.map((err, idx) => (
                                        <li key={idx}>
                                            • {err.source} ({err.keyword}):{" "}
                                            {err.error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-10 flex flex-col h-[calc(100vh-210px)]">
                {/* 独立滚动的数据列表区域 */}
                <div className="flex-1 overflow-y-auto pr-2">
                    <ul className="space-y-4">
                        {items.map(item => (
                            <li
                                key={item.id}
                                className="table-details-content border border-black"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                        {item.source}
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                        {item.keyword}
                                    </span>
                                    <span className="text-xs ml-auto">
                                        {item.published_at &&
                                            new Date(
                                                item.published_at
                                            ).toLocaleString("zh-CN")}
                                    </span>
                                </div>

                                {item.title && (
                                    <h2 className="font-semibold text-lg mb-2">
                                        {item.title}
                                    </h2>
                                )}

                                {item.content && (
                                    <p className="mb-2">
                                        {item.content}
                                    </p>
                                )}

                                {item.url && (
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline text-sm"
                                    >
                                        全文を見る →
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>

                    {items.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            記事がありません
                        </div>
                    )}
                </div>

                {/* 分页固定在结果区域下方，不跟列表一起滚动 */}
                {itemTotal > 10 && (
                    <div className="flex justify-center gap-2 mt-4 shrink-0">
                        <button
                            disabled={itemPage === 1}
                            onClick={() => setItemPage(p => p - 1)}
                            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                        >
                            前へ
                        </button>

                        <span className="px-4 py-2">
                            {itemPage} / {Math.ceil(itemTotal / 10)}
                        </span>

                        <button
                            disabled={itemPage * 10 >= itemTotal}
                            onClick={() => setItemPage(p => p + 1)}
                            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                        >
                            次へ
                        </button>
                    </div>
                )}
            </div>
            <LoadingModal show={loading} message={loadingMessage} />
        </div>
    );
}
