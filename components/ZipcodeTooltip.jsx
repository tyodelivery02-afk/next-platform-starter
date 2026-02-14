// components/ZipcodeTooltip.jsx
"use client";

import { useEffect, useState } from "react";
import { X, Download } from "phosphor-react";

export default function ZipcodeTooltip({ areaName, prefName, position, onClose }) {
    const [zipcodes, setZipcodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        console.log('ZipcodeTooltip - areaName:', areaName);
        console.log('ZipcodeTooltip - prefName:', prefName);

        if (!areaName || !prefName) {
            console.warn('ZipcodeTooltip - Missing parameters:', { areaName, prefName });
            setLoading(false);
            setError('地域情報が不足しています');
            return;
        }

        const fetchZipcodes = async () => {
            setLoading(true);
            setError(null);

            try {
                const url = `/api/zipcode?prefName=${encodeURIComponent(prefName)}&cityName=${encodeURIComponent(areaName)}`;
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
    }, [areaName, prefName]);

    const downloadCSV = () => {
        if (zipcodes.length === 0) return;

        // CSV 头部
        const headers = ['郵便番号', 'タイプ', '地域'];

        // CSV 数据行
        const rows = zipcodes.map(zip => {
            const type = zip.flag === 1 ? '住所' : '事務所';
            const town = zip.town || '';
            return [zip.zipcode, type, town];
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

    if (!position) return null;

    return (
        <div
            className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 max-w-md max-h-96 overflow-auto z-50"
            style={{
                left: `${position.x + 15}px`,
                top: `${position.y + 15}px`,
                minWidth: "280px",
            }}
            onMouseLeave={onClose}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-800">
                    {areaName} {!loading && !error && zipcodes.length > 0 && `(${zipcodes.length}件)`}
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={downloadCSV}
                        disabled={loading || error || zipcodes.length === 0}
                        className="floppyDisk-button"
                        title="CSV出力"
                    >
                        <Download size={24} weight="bold" />
                    </button>
                    <button
                        onClick={onClose}
                        className="x-button"
                    >
                        <X size={24} weight="bold" />
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-600">読み込み中...</span>
                </div>
            )}

            {error && (
                <div className="text-red-500 py-4">
                    <p className="font-semibold">エラー</p>
                    <p className="text-sm">{error}</p>
                    <p className="text-xs mt-2 text-gray-500">
                        都道府県: {prefName || '(未設定)'}<br />
                        地域: {areaName || '(未設定)'}
                    </p>
                </div>
            )}

            {!loading && !error && zipcodes.length === 0 && (
                <div className="text-gray-600 py-4">
                    <p className="font-semibold mb-2">郵便番号データがありません</p>
                    <p className="text-sm">
                        この地域の郵便番号情報が見つかりませんでした。<br></br>
                        ※データベースと市名が不一致が原因<br></br>
                        ※時間あったら直します．．．
                    </p>
                </div>
            )}

            {!loading && !error && zipcodes.length > 0 && (
                <div>
                    {/* 住所邮编 (flag=1) */}
                    {zipcodes.filter(z => z.flag === 1).length > 0 && (
                        <div className="mb-4">
                            <h4 className="font-semibold text-gray-700 mb-2 pb-1 border-b border-gray-300">
                                住所 ({zipcodes.filter(z => z.flag === 1).length}件)
                            </h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {zipcodes.filter(z => z.flag === 1).map((zip, index) => (
                                    <div
                                        key={`residence-${index}`}
                                        className="table-details-content"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-blue-600 font-semibold">
                                                〒{zip.zipcode}
                                            </span>
                                            {zip.town && (
                                                <div className="truncate">{zip.town}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 事务所邮编 (flag=2) */}
                    {zipcodes.filter(z => z.flag === 2).length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2 pb-1 border-b border-gray-300">
                                事務所 ({zipcodes.filter(z => z.flag === 2).length}件)
                            </h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {zipcodes.filter(z => z.flag === 2).map((zip, index) => (
                                    <div
                                        key={`office-${index}`}
                                        className="table-details-content"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-green-600 font-semibold">
                                                〒{zip.zipcode}
                                            </span>
                                            {zip.town && (
                                                <div className="truncate">{zip.town}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}