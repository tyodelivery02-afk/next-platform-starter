"use client";

import { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { ArrowLeft, ArrowRight } from "phosphor-react";

/**
 * 使用 JsBarcode 库生成 SVG
 */
const generateBarcodeSVG = (text, type, height, fontSize) => {
    const svgNS = "http://www.w3.org/2000/svg";
    const svgElement = document.createElementNS(svgNS, "svg");

    try {
        JsBarcode(svgElement, text, {
            format: type.toUpperCase(),
            height,
            displayValue: true,
            fontSize,
            margin: 10,
            background: "#ffffff",
            lineColor: "#000000",
            width: 2
        });

        return new XMLSerializer().serializeToString(svgElement);
    } catch (error) {
        console.error('Barcode Generation Error:', error);
        return `<svg width="200" height="50" xmlns="http://www.w3.org/2000/svg">
            <text x="10" y="30" fill="red" font-size="12">Invalid: ${text}</text>
        </svg>`;
    }
};

const BarcodeGenerator = () => {
    const [text, setText] = useState('');
    const [barcodeType, setBarcodeType] = useState('code128');
    const [spacing, setSpacing] = useState(20);
    const [barcodeHeight, setBarcodeHeight] = useState(80);
    const [fontSize, setFontSize] = useState(14);
    const [displayMode, setDisplayMode] = useState('grid');
    const [currentIndex, setCurrentIndex] = useState(0);

    const barcodes = text.split('\n').filter(line => line.trim());

    /* 翻页快捷键（单个显示模式） */
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (displayMode === 'single' && barcodes.length > 0) {
                if (e.key === 'ArrowLeft') {
                    setCurrentIndex(prev => Math.max(0, prev - 1));
                } else if (e.key === 'ArrowRight') {
                    setCurrentIndex(prev => Math.min(barcodes.length - 1, prev + 1));
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [displayMode, barcodes.length]);

    const downloadBarcode = (barcode) => {
        const svgStr = generateBarcodeSVG(barcode, barcodeType, barcodeHeight, fontSize);
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `barcode_${barcode}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadAllBarcodes = () => {
        barcodes.forEach((barcode, index) => {
            setTimeout(() => downloadBarcode(barcode), index * 100);
        });
    };

    const renderBarcode = (barcode, index) => (
        <div
            key={index}
            className="relative p-6 rounded-lg border-2 bg-white border-gray-200 table-details"
            style={{ marginBottom: spacing }}
        >
            <div className="flex flex-col items-center">
                <div
                    dangerouslySetInnerHTML={{
                        __html: generateBarcodeSVG(barcode, barcodeType, barcodeHeight, fontSize)
                    }}
                />
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-white">
            {/* 左侧控制栏 */}
            <div className="w-80 bg-gray-50 shadow-lg overflow-y-auto p-6 border-r border-gray-200">
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        1行1つで入力（{barcodes.length} 個入力した）
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full h-92 px-3 py-2 textarea-item"
                    />
                </div>

                <details open className="table-details">
                    <summary className="table-details-content">
                        設定
                    </summary>

                    <div className="p-3 space-y-3 text-sm">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                バーコードタイプ
                            </label>
                            <select
                                value={barcodeType}
                                onChange={(e) => setBarcodeType(e.target.value)}
                                className="w-full text-black px-2 py-1 border border-gray-300 rounded"
                            >
                                <option value="code128">CODE 128</option>
                                <option value="code39">CODE 39</option>
                                <option value="ean13">EAN-13</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                間隔: {spacing}px
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={spacing}
                                onChange={(e) => setSpacing(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                高さ: {barcodeHeight}px
                            </label>
                            <input
                                type="range"
                                min="40"
                                max="200"
                                value={barcodeHeight}
                                onChange={(e) => setBarcodeHeight(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                フォントサイズ: {fontSize}px
                            </label>
                            <input
                                type="range"
                                min="8"
                                max="24"
                                value={fontSize}
                                onChange={(e) => setFontSize(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>
                </details>

                <button
                    onClick={downloadAllBarcodes}
                    className="orther-button"
                >
                    一括DL
                </button>
            </div>

            {/* 右侧显示区 */}
            <div className="flex-1 flex flex-col">
                <div className="flex justify-start p-4 border-b border-gray-200">
                    <button
                        onClick={() => {
                            setDisplayMode(displayMode === 'grid' ? 'single' : 'grid');
                            setCurrentIndex(0);
                        }}
                        className="orther-button"
                    >
                        {displayMode === 'grid' ? '1 per page' : 'All in one page'}
                    </button>
                </div>

                <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
                    {barcodes.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            バーコードは、商品を迅速かつ正確に管理することを目的として生まれました。1940年代にアメリカで考案され、レジでの会計や在庫管理を効率化する技術として、1970年代以降に広く普及しました。
                            <br></br>
                            バーコードの原理は、黒い線と白い線の幅の違いによって情報を表している点にあります。読み取り機はバーコードに光を当て、白い部分で反射し、黒い部分で吸収される光の差を検知します。その反射のパターンを電気信号に変換することで、数字や商品情報として読み取る仕組みになっています。
                        </div>
                    ) : displayMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {barcodes.map(renderBarcode)}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center">
                            <div className="max-w-2xl w-full">
                                {renderBarcode(barcodes[currentIndex], currentIndex)}
                            </div>
                            <div className="flex items-center gap-4 mt-8">
                                <button
                                    onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                                    disabled={currentIndex === 0}
                                    className="orther-button"
                                >
                                    <ArrowLeft size={25} weight="bold" />
                                </button>
                                <p className="text-xl text-black mb-4">
                                    {currentIndex + 1} / {barcodes.length}
                                </p>
                                <button
                                    onClick={() => setCurrentIndex(i => Math.min(barcodes.length - 1, i + 1))}
                                    disabled={currentIndex === barcodes.length - 1}
                                    className="orther-button"
                                >
                                    <ArrowRight size={25} weight="bold" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BarcodeGenerator;
