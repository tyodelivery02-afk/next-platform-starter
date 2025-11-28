"use client";
import React, { useState, useImperativeHandle, forwardRef } from "react";
import { WarningOctagon } from "phosphor-react";

const WarningModal = forwardRef(function WarningModal(_, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [title, setTitle] = useState("警告");

    useImperativeHandle(ref, () => ({
        open({ title = "警告", message }) {
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
                <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
                <p className="mb-6 text-gray-700 leading-relaxed inline-flex items-center gap-2">
                    {message}
                    <span className="flex justify-center items-center">
                        <WarningOctagon size={32} className="text-red-500" />
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

export default WarningModal;
