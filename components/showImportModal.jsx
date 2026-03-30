"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, CaretDown, PencilSimple, Check } from "phosphor-react";

export default function ImportColorModal({
    show,
    onClose,
    uniqueColorKeys,
    importColorMapping,
    setImportColorMapping,
    colorPalette,
    colorNames,
    latestDbColorNames,
    importEditableColorNames,
    setImportEditableColorNames,
    onApply
}) {
    const [openKey, setOpenKey] = useState(null);
    const [editingKey, setEditingKey] = useState(null);
    const dropdownRefs = useRef({});

    const colorOptions = useMemo(() => {
        return Object.entries(colorPalette).map(([colorId, hex]) => ({
            colorId,
            hex,
            name:
                importEditableColorNames?.[colorId] ||
                latestDbColorNames?.[colorId] ||
                colorNames?.[colorId] ||
                colorId
        }));
    }, [colorPalette, colorNames, latestDbColorNames, importEditableColorNames]);

    const getDisplayName = (colorId) => {
        if (!colorId) return "— 色を選択 —";
        return (
            importEditableColorNames?.[colorId] ||
            latestDbColorNames?.[colorId] ||
            colorNames?.[colorId] ||
            colorId
        );
    };

    useEffect(() => {
        if (!show) {
            setOpenKey(null);
            setEditingKey(null);
            return;
        }

        const handleClickOutside = (event) => {
            if (!openKey) return;
            const targetRef = dropdownRefs.current[openKey];
            if (targetRef && !targetRef.contains(event.target)) {
                setOpenKey(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [show, openKey]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-end border-b">
                    <button onClick={onClose} className="x-button">
                        <X size={24} weight="bold" />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                        {uniqueColorKeys.map((key) => {
                            const selectedColorId = importColorMapping[key] || "";

                            return (
                                <div
                                    key={key}
                                    className="grid grid-cols-[64px_1fr_40px] items-start gap-3"
                                >
                                    <span className="text-center font-mono font-bold text-gray-800 bg-yellow-200 rounded px-2 py-2 text-sm shrink-0">
                                        {key}
                                    </span>

                                    <div
                                        className="relative"
                                        ref={(el) => {
                                            if (el) dropdownRefs.current[key] = el;
                                        }}
                                    >
                                        {editingKey === key && selectedColorId ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                    value={importEditableColorNames?.[selectedColorId] || ""}
                                                    onChange={(e) => {
                                                        setImportEditableColorNames((prev) => ({
                                                            ...prev,
                                                            [selectedColorId]: e.target.value
                                                        }));
                                                    }}
                                                    onBlur={() => setEditingKey(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            setEditingKey(null);
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    className="w-10 h-10 flex items-center justify-center rounded hover:bg-yellow-200"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => setEditingKey(null)}
                                                    title="確定"
                                                >
                                                    <Check size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="w-full min-h-[40px] border border-gray-300 rounded px-3 py-2 text-sm flex items-center justify-between gap-3 hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                    onClick={() =>
                                                        setOpenKey((prev) => (prev === key ? null : key))
                                                    }
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {selectedColorId ? (
                                                            <span
                                                                className="w-4 h-4 rounded border border-gray-300 shrink-0"
                                                                style={{
                                                                    backgroundColor:
                                                                        colorPalette[selectedColorId]
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className="w-4 h-4 rounded border border-gray-300 bg-gray-100 shrink-0" />
                                                        )}

                                                        <span className="truncate text-left">
                                                            {getDisplayName(selectedColorId)}
                                                        </span>
                                                    </div>

                                                    <CaretDown
                                                        size={16}
                                                        className={`shrink-0 transition-transform ${openKey === key ? "rotate-180" : ""
                                                            }`}
                                                    />
                                                </button>

                                                {openKey === key && (
                                                    <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                                                        <button
                                                            type="button"
                                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 border-b"
                                                            onClick={() => {
                                                                setImportColorMapping((prev) => ({
                                                                    ...prev,
                                                                    [key]: ""
                                                                }));
                                                                setEditingKey(null);
                                                                setOpenKey(null);
                                                            }}
                                                        >
                                                            — 色を選択 —
                                                        </button>

                                                        <div className="max-h-64 overflow-y-auto">
                                                            {colorOptions.map(({ colorId, hex, name }) => (
                                                                <button
                                                                    key={colorId}
                                                                    type="button"
                                                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-yellow-200 transition-all duration-300"
                                                                    onClick={() => {
                                                                        setImportColorMapping((prev) => ({
                                                                            ...prev,
                                                                            [key]: colorId
                                                                        }));
                                                                        setEditingKey(null);
                                                                        setOpenKey(null);
                                                                    }}
                                                                >
                                                                    <span
                                                                        className="w-4 h-4 rounded border border-gray-300 shrink-0"
                                                                        style={{ backgroundColor: hex }}
                                                                    />
                                                                    <span className="truncate">{name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div className="pt-[2px] flex justify-center">
                                        <button
                                            type="button"
                                            className={`w-10 h-10 rounded flex items-center justify-center transition ${selectedColorId
                                                ? "hover:bg-yellow-200 text-black"
                                                : "text-gray-300 cursor-not-allowed"
                                                }`}
                                            disabled={!selectedColorId}
                                            onClick={() => {
                                                if (!selectedColorId) return;
                                                setOpenKey(null);
                                                setEditingKey((prev) => (prev === key ? null : key));
                                            }}
                                            title="色名を編集"
                                        >
                                            <PencilSimple size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {uniqueColorKeys.length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                            データが見つかりませんでした。
                        </p>
                    )}
                </div>

                <div className="px-5 pb-4 pt-2 flex justify-end gap-2 border-t">
                    <button onClick={onClose} className="clear-button">
                        キャンセル
                    </button>
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