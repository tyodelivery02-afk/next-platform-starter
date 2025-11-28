"use client";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Question } from "phosphor-react";

export default function ConfirmModal({
  onConfirm,
  title = "確認",
  message = "",
  buttonText = "",
  buttonColor = "save-button",
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
        className={`${buttonColor}`}
      >
        {buttonText}
      </button>

      {/* 弹窗 */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={handleCancel}
          >
            <div
              className="glass-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 text-black">{title}</h3>
              <p className="mb-6 inline-flex items-center gap-2 text-black">
                {message} <Question size={32} />
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={handleCancel}
                  className="no-button"
                >
                  NO
                </button>
                <button
                  onClick={handleConfirm}
                  className="ok-button"
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}