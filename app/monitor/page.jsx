"use client";

import { useEffect, useState } from "react";
import LoadingModal from "components/loading";

export default function MonitorPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState("Loading...");
    const [itemPage, setItemPage] = useState(1);
    const [itemTotal, setItemTotal] = useState(0);

    async function loadList(page = itemPage) {
        const res = await fetch(`/api/monitor/list?page=${page}`);
        const data = await res.json();
        setItems(data.items || []);
        setItemTotal(data.total || 0);
    }

    useEffect(() => {
        loadList(itemPage);
    }, [itemPage]);

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
                        {itemTotal} 件記事
                    <div className="flex flex-col mr-30 ml-auto">
                        <p className="text-xl font-medium">je ne vois que d’un point, mais dans mon existence je suis regardé de partout.</p>
                        <p className="font-medium">- I see only from one point, but in my existence I am looked from everywhere. -</p>
                    </div>
                </div>

                {/* 执行结果 */}
                {result && (
                    <div
                        className="mt-4 p-4 rounded bg-yellow-50 border border-yellow-200"
                    >
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
                                <p className="font-semibold text-sm mb-1">
                                    遇到的问题：
                                </p>
                                <ul className="text-sm space-y-1">
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

            <div className="mt-10">
                {/* 数据列表 */}
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

                {/* items 分页 */}
                {itemTotal > 10 && (
                    <div className="flex justify-center gap-2 mt-4">
                        <button
                            disabled={itemPage === 1}
                            onClick={() => setItemPage(p => p - 1)}
                            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                        >
                            前へ
                        </button>

                        <span className="px-4 py-2">
                            {itemPage}  / {" "}
                            {Math.ceil(itemTotal / 10)}
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

                {items.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        記事がありません
                    </div>
                )}
            </div>
            <LoadingModal show={loading} message={loadingMessage} />
        </div>
    );
}
