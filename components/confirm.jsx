"use client";
import React, { useState } from "react";

export default function ConfirmModal({
  onConfirm,
  title = "確認",
  message = "",
  buttonText = "",
  buttonColor = "bg-gray-400 hover:bg-gray-500",
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleCancel = () => setIsOpen(false);
  const handleConfirm = () => {
    onConfirm?.();
    setIsOpen(false);
  };

  return (
    <>
      {/* 主按钮 */}
      <button
        onClick={handleOpen}
        className={`${buttonColor} text-white text-sm px-4 py-2 rounded-lg`}
      >
        {buttonText}
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          onClick={handleCancel}
        >
          <div
            className="bg-white rounded-2xl p-6 w-80 shadow-2xl border border-gray-200 relative transform transition-all duration-300 scale-100 hover:scale-[1.02]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
            <p className="mb-6 inline-flex items-center gap-2 text-gray-700 leading-relaxed">
              {message}
              <img
                src="/images/question.svg"
                className="w-20"
              />
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
              >
                NO
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 shadow-md transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}