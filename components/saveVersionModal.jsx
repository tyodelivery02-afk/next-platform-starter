"use client";

import React from "react";
import { X } from "phosphor-react";

/**
 * SaveVersionModal - 参照 AreaEditor 风格制作的通用版本命名模态框
 * * @param {boolean} show - 显隐控制
 * @param {string} value - 版本名绑定值
 * @param {function} onChange - 修改绑定值的函数 (e) => setVersionName(e.target.value)
 * @param {function} onClose - 关闭模态框
 * @param {function} onSave - 点击保存按钮的回调
 */
export default function SaveVersionModal({
    show,
    value,
    onChange,
    onClose,
    onSave
}) {
    if (!show) return null;

    // 键盘快捷键处理
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && value.trim()) {
            onSave();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 select-none"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800">新しいバージョンを保存</h2>
                    <button
                        onClick={onClose}
                        className="x-button"
                    >
                        <X size={20} weight="bold" />
                    </button>
                </div>
                <div className="p-6">
                    <div className="mb-2">
                        <input
                            type="text"
                            value={value}
                            onChange={onChange}
                            className="w-full textarea-item"
                            placeholder="バージョン名"
                            autoFocus
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 bg-gray-50/50 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="clear-button"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!value.trim()}
                        className="save-button"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}