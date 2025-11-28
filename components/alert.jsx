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
                className="glass-card"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold mb-4 text-black">{title}</h3>
                <p className="mb-6 text-black leading-relaxed inline-flex items-center gap-2">
                    {message}
                    <span className="flex justify-center items-center">
                        {message === "保存成功！" && <Smiley size={32} className="text-sky-500" />}
                        {message === "保存失敗！" && <SmileySad size={32} className="text-yellow-500" />}
                    </span>
                </p>
                <div className="flex justify-end">
                    <button
                        onClick={handleClose}
                        className="ok-button"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
});

export default AlertModal;
