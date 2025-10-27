"use client";
import React, { useState, useImperativeHandle, forwardRef } from "react";
import { Smiley,SmileySad  } from "phosphor-react";

const AlertModal = forwardRef(function AlertModal(_, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [title, setTitle] = useState("実行結果");

    useImperativeHandle(ref, () => ({
        open({ title = "実行結果", message }) {
            setTitle(title);
            setMessage(message);
            setIsOpen(true);
        },
    }));

    const handleClose = () => setIsOpen(false);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-2xl p-6 w-80 shadow-2xl border border-gray-200 relative transform transition-all duration-300 scale-100 hover:scale-[1.02]"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
                <p className="mb-6 text-gray-700 leading-relaxed inline-flex items-center gap-2">
                    {message}
                    <span className="flex justify-center items-center">
                        {message === "保存成功！" && <Smiley size={32} className="text-green-500" />}
                        {message === "保存失敗！" && <SmileySad size={32} className="text-red-500" />}
                    </span>
                </p>
                <div className="flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 shadow-md transition"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
});

export default AlertModal;
