"use client";
import { X } from "phosphor-react";

export default function ImportResultModal({ show, onClose, importErrors }) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-end">
                    <button onClick={onClose} className="x-button"><X size={24} weight="bold" /></button>
                </div>

                <div className="px-5 py-4">
                    <p className="text-sm font-bold text-red-600 mb-2">※{importErrors.length} 件のエリアが見つかりませんでした、
                        ファイル内の名称が地図データの名称と一致しているか確認してください。</p>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b block w-full">
                                <tr className="flex w-full">
                                    <th className="px-3 py-2 text-left flex-1">都道府県 ＞ 市区町村</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y max-h-60 overflow-y-auto block w-full">
                                {importErrors.map((err, idx) => (
                                    <tr key={idx} className="flex w-full">
                                        <td className="px-3 py-2 flex-1 table-details-content">
                                            {err.prefName} <span className="mx-2 text-gray-400">＞</span> {err.areaName}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="px-5 pb-5">
                </div>
            </div>
        </div>
    );
}