"use client";
import { X } from "phosphor-react";

export default function ImportColorModal({
    show,
    onClose,
    uniqueColorKeys,
    importColorMapping,
    setImportColorMapping,
    colorPalette,
    colorNames,
    onApply
}) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-end">
                    <button onClick={onClose} className="x-button"><X size={24} weight="bold" /></button>
                </div>

                <div className="px-5 py-4">
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {uniqueColorKeys.map(key => (
                            <div key={key} className="flex items-center gap-3">
                                <span className="w-12 text-center font-mono font-bold text-gray-800 bg-yellow-200 rounded px-2 py-1 text-sm shrink-0">{key}</span>
                                <select
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    value={importColorMapping[key] || ''}
                                    onChange={e => setImportColorMapping(prev => ({ ...prev, [key]: e.target.value }))}
                                >
                                    <option value="">— 色を選択 —</option>
                                    {Object.entries(colorPalette).map(([colorId, hex]) => (
                                        <option key={colorId} value={colorId}>{colorNames[colorId] || colorId}</option>
                                    ))}
                                </select>
                                {importColorMapping[key] && (
                                    <span className="w-6 h-6 rounded shrink-0 border border-gray-300" style={{ backgroundColor: colorPalette[importColorMapping[key]] }} />
                                )}
                            </div>
                        ))}
                    </div>
                    {uniqueColorKeys.length === 0 && <p className="text-center text-gray-500 py-4">データが見つかりませんでした。</p>}
                </div>

                <div className="px-5 pb-4 flex justify-end gap-2">
                    <button onClick={onClose} className="clear-button">キャンセル</button>
                    <button
                        onClick={onApply}
                        disabled={uniqueColorKeys.length === 0}
                        className="orther-button"
                    >
                        適用
                    </button>
                </div>
            </div>
        </div>
    );
}