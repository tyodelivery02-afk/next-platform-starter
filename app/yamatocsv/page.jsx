'use client';

import { useState } from 'react';

export default function CSVProcessor() {
    const cities = ['tokyo', 'osaka'];
    const types = ['yotei', 'kakutei'];

    const [city, setCity] = useState('tokyo');
    const [type, setType] = useState('yotei');

    const [csvData, setCsvData] = useState('');
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 检测文本是否包含乱码（UTF-8解码失败的情况）
    const hasGarbledText = (text) => {
        // 检查是否包含大量替换字符（�）或无效字符
        const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
        // 如果替换字符超过5%，可能是编码错误
        return replacementCharCount > text.length * 0.05;
    };

    // 文件上传 & 自动编码检测
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (ev) => {
            try {
                const arrayBuffer = ev.target.result;
                let text;
                let encoding = 'UTF-8';

                // 首先尝试 UTF-8 解码
                try {
                    text = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);

                    // 检查是否有乱码
                    if (hasGarbledText(text)) {
                        throw new Error('UTF-8 decoding produced garbled text');
                    }
                } catch (utf8Error) {
                    // UTF-8 解码失败，尝试 Shift-JIS
                    try {
                        text = new TextDecoder('shift_jis').decode(arrayBuffer);
                        encoding = 'Shift-JIS';
                    } catch (sjisError) {
                        throw new Error('両方のエンコーディング（UTF-8、Shift-JIS）で解読に失敗しました');
                    }
                }

                setCsvData(text);
                setFileName(file.name);
                setSuccess(`CSVファイルを読み込みました\nエンコーディング: ${encoding}`);
                setError('');
            } catch (err) {
                console.error(err);
                setError(err.message || 'CSVの読み込みに失敗しました');
                setSuccess('');
            }
        };

        reader.readAsArrayBuffer(file);
    };

    // CSV 解析 & 合并
    const parseCSV = (text) => {
        const lines = text.split('\n');
        const result = [];

        for (let line of lines) {
            // 跳過完全空白的行
            if (!line.trim()) continue;

            const cells = [];
            let cell = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    cells.push(cell);
                    cell = '';
                } else {
                    cell += char;
                }
            }
            cells.push(cell);
            result.push(cells);
        }

        return result;
    };

    const csvToString = (data) => {
        return data
            .map((row) =>
                row
                    .map((cell) => {
                        const str = String(cell || '');
                        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    })
                    .join(',')
            )
            .join('\n');
    };

    // CSV 处理
    const processYoteiData = (data, city) => {
        if (data.length < 2) throw new Error('データが不足しています');
        const processed = data.map((row) => [...row]);

        // 刪除A1單元格的 ?? 
        if (processed[0] && processed[0][0]) {
            processed[0][0] = processed[0][0].replace(/？？/g, '').replace(/\?\?/g, '');
        }

        // 檢查A列和B列是否一致
        for (let i = 1; i < processed.length; i++) {
            const a = processed[i][0];
            const b = processed[i][1];
            if (a && b && a !== b) {
                throw new Error(`${i + 1}行目: A列(${a})とB列(${b})が一致しません`);
            }
        }

        // 設置運費請求代碼
        const code = city === 'osaka' ? '072463680100' : '072463680198';
        for (let i = 1; i < processed.length; i++) {
            while (processed[i].length < 18) processed[i].push('');
            processed[i][17] = code;
        }

        // 限制M列（第13列，索引12）為10個字符
        for (let i = 1; i < processed.length; i++) {
            if (processed[i][12]) {
                processed[i][12] = String(processed[i][12]).substring(0, 10);
            }
        }

        return processed;
    };

    const processKakuteiData = (data) => {
        if (data.length < 2) throw new Error('データが不足しています');
        const processed = [];

        // 第1行：保持標題行
        processed.push([...data[0]]);

        // 第2行：插入空白行
        processed.push(new Array(data[0].length).fill(''));

        // 第3行起：添加原數據（從原數據的第2行開始）
        for (let i = 1; i < data.length; i++) {
            processed.push([...data[i]]);
        }

        return processed;
    };

    // CSV 导出
    const handleExport = () => {
        if (!csvData) {
            setError('CSVファイルを読み込んでください');
            setSuccess('');
            return;
        }

        try {
            const parsed = parseCSV(csvData);

            let processed;
            if (type === 'yotei') processed = processYoteiData(parsed, city);
            else processed = processKakuteiData(parsed);

            const csvString = csvToString(processed);
            const bom = '\uFEFF';
            const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `processed_${city}_${type}_${Date.now()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setSuccess('CSVファイルをエクスポートしました');
            setError('');
        } catch (err) {
            console.error(err);
            setError(err.message || 'CSV処理中にエラーが発生しました');
            setSuccess('');
        }
    };

    // CSV 预览
    const csvPreview = csvData ? parseCSV(csvData).slice(0, 50) : [];
    const totalRows = csvData ? parseCSV(csvData).length : 0;

    return (
        <div className="bg-style">
            {/* 標題 */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="relative text-x2 font-bold text-black text-shadow">ヤマト予定確定データ</h2>
            </div>
            <div
                className="w-full h-6 my-6"
                style={{
                    backgroundImage: "url(/images/divider.svg)",
                    backgroundRepeat: "repeat-x",
                    backgroundSize: "auto 35%",
                }}
            ></div>

            {/* 兩列布局 */}
            <div className="flex flex-col md:flex-row gap-8">
                {/* 左列：單選按鈕組 + 文件上傳/導出 + CSV 說明 */}
                <div className="flex-1 flex flex-col gap-6">
                    {/* 单选按钮组横向排列，大间距 */}
                    <div className="table-div p-8 mb-6">

                        {/* 上排：城市 + 类型 */}
                        <div className="flex flex-wrap gap-16 mb-6">
                            {/* 都市 */}
                            <div>
                                <div className="flex gap-6">
                                    {cities.map((c) => (
                                        <label key={c} className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                name="city"
                                                value={c}
                                                checked={city === c}
                                                onChange={() => setCity(c)}
                                                className="mr-1"
                                            />
                                            {c === 'tokyo' ? '東京' : '大阪'}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* 类型 */}
                            <div>
                                <div className="flex gap-6">
                                    {types.map((t) => (
                                        <label key={t} className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                name="type"
                                                value={t}
                                                checked={type === t}
                                                onChange={() => setType(t)}
                                                className="mr-1"
                                            />
                                            {t === 'yotei' ? '予定' : '確定'}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 下排：文件上传 + 导出按钮 + 提示消息 */}
                        <div className="flex flex-wrap items-center gap-6 mb-4">
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="inputfile-item" />
                            {csvData && (
                                <button onClick={handleExport} className="orther-button">
                                    エクスポート
                                </button>
                            )}
                        </div>

                        {/* 提示消息 */}
                        <div>
                            {error && <p className="text-red-600">{error}</p>}
                            {success && (
                                <p className="text-black whitespace-pre-line">
                                    {success}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* CSV 处理说明横向排列 */}
                    <div className="table-div p-6 flex flex-wrap gap-6 justify-start">
                        {type === 'yotei' ? (
                            <>
                                <div className="tab-style">A1セルの「??」を削除</div>
                                <div className="tab-style">A列とB列（2行目以降）の値が一致するか検証</div>
                                <div className="tab-style">
                                    R列（2行目以降）に運賃請求先コード（{city === 'osaka' ? '072463680100' : '072463680198'}）を設定
                                </div>
                                <div className="tab-style">M列（2行目以降）の荷送人名を10文字以内に制限</div>
                            </>
                        ) : (
                            <>
                                <div className="tab-style">1行目：ヘッダー行をそのまま保持</div>
                                <div className="tab-style">2行目：空白行を挿入</div>
                                <div className="tab-style">3行目以降：元データをそのまま追加</div>
                            </>
                        )}
                    </div>
                </div>

                {/* 右列：CSV 预览表格，不折行 */}
                <div className="flex-1 w-full table-div p-8 max-h-[700px] overflow-auto">
                    {/* 預覽標題和行數信息 */}
                    <div className="mb-4 pb-2 border-b border-gray-300">
                        <h3 className="text-2lg font-semibold text-black">プレビュー</h3>
                        {csvData && (
                            <p className="text-sm text-gray-600 mt-1">
                                総 {totalRows}行 {csvPreview.length < totalRows && `（${csvPreview.length}行まで表示）`}
                            </p>
                        )}
                    </div>

                    <table className="min-w-full table-auto border-collapse whitespace-nowrap">
                        <tbody>
                            {csvPreview.map((row, i) => (
                                <tr key={i} className="table-details-content">
                                    {row.map((cell, j) => (
                                        <td key={j} className="px-2 py-1 border-r last:border-r-0 text-black">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}