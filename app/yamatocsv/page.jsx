'use client';

import { useState, useEffect } from 'react';
import { PersonSimpleRun, Cat, X, } from "phosphor-react";
import Encoding from 'encoding-japanese';

export default function CSVProcessor() {
    const cities = ['tokyo', 'osaka'];
    const types = ['yotei', 'kakutei'];
    const modes = ['yamato', 'sagawa'];

    const [mode, setMode] = useState('yamato');
    const [city, setCity] = useState('tokyo');
    const [type, setType] = useState('yotei');

    const [csvData, setCsvData] = useState('');
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // CSV分隔符设置
    const [delimiter, setDelimiter] = useState(',');
    const [customDelimiter, setCustomDelimiter] = useState('');

    // Google Drive 相关状态
    const [isGoogleAuthorized, setIsGoogleAuthorized] = useState(false);
    const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

    // 自定义规则相关状态
    const [rules, setRules] = useState([]);
    const [savedRules, setSavedRules] = useState([]); // 已保存的规则
    const [newRule, setNewRule] = useState({
        rowCondition: '',
        rowValue: '',
        colCondition: '',
        colValue: '',
        valueCondition: '',
        valueValue: '',
        valueStart: '',  // 起始位置
        valueLength: '', // 字符数
        actionType: 'に修正',
        actionValue: ''
    });
    const [loadingRules, setLoadingRules] = useState(false);
    const [savingRules, setSavingRules] = useState(false);
    const [inputEncoding, setInputEncoding] = useState('UTF-8');

    // 定位条件选项
    const rowConditions = ['', '行=', '行=@以降'];
    const colConditions = ['', '列=', '列=@以降'];
    const valueConditions = ['', '値=', '値=@q'];
    const actionTypes = ['に修正', 'を削除', 'を挿入', '行を挿入'];

    // 加载规则
    useEffect(() => {
        loadRules();
    }, [mode, city, type]);

    // 检查Google授权状态
    useEffect(() => {
        checkGoogleAuth();
    }, []);

    const checkGoogleAuth = async () => {
        try {
            const response = await fetch('/api/google-drive/auth-status');
            if (response.ok) {
                const data = await response.json();
                setIsGoogleAuthorized(data.authorized);
            }
        } catch (err) {
            console.error('Google認証状態の確認エラー:', err);
        }
    };

    const loadRules = async () => {
        setLoadingRules(true);
        try {
            const response = await fetch(`/api/yamatocsv?mode=${mode}&city=${city}&type=${type}`);
            if (response.ok) {
                const data = await response.json();
                const loadedRules = data.rules || [];
                setSavedRules(loadedRules);
                setRules(loadedRules);
            }
        } catch (err) {
            console.error('規則の読み込みエラー:', err);
        } finally {
            setLoadingRules(false);
        }
    };

    // 构建规则location字符串
    const buildLocation = (rule) => {
        const parts = [];

        if (rule.rowCondition) {
            if (rule.rowCondition === '行=@以降') {
                parts.push(`行=${rule.rowValue}以降`);
            } else {
                parts.push(`${rule.rowCondition}${rule.rowValue}`);
            }
        }

        if (rule.colCondition && rule.colValue) {
            if (rule.colCondition === '列=@以降') {
                parts.push(`列=${rule.colValue}以降`);
            } else {
                parts.push(`${rule.colCondition}${rule.colValue}`);
            }
        }

        if (rule.valueCondition) {
            if (rule.valueCondition === '値=@q') {
                // 区间模式: 値=@q起始,字符数
                parts.push(`値=@q${rule.valueStart},${rule.valueLength}`);
            } else {
                // 完全匹配模式
                parts.push(`${rule.valueCondition}${rule.valueValue}`);
            }
        }

        return parts.join(' ');
    };

    // 构建规则action字符串
    const buildAction = (rule) => {
        if (rule.actionType === '行を挿入') {
            return `${rule.actionValue || '1'}${rule.actionType}`;
        }
        return `${rule.actionValue}${rule.actionType}`;
    };

    // 添加规则并自动保存
    const addRule = async () => {
        const location = buildLocation(newRule);
        const action = buildAction(newRule);

        if (!location.trim() || !action.trim()) {
            setError('定位と操作の両方を入力してください');
            return;
        }

        const newRuleItem = {
            id: Date.now(),
            location,
            action
        };

        const updatedRules = [...rules, newRuleItem];
        setRules(updatedRules);

        // 重置表单
        setNewRule({
            rowCondition: '',
            rowValue: '',
            colCondition: '',
            colValue: '',
            valueCondition: '',
            valueValue: '',
            valueStart: '',
            valueLength: '',
            actionType: 'に修正',
            actionValue: ''
        });
        setError('');

        // 自动保存到数据库
        setSavingRules(true);
        try {
            const response = await fetch('/api/yamatocsv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    city,
                    type,
                    rules: updatedRules
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSavedRules(data.rules || updatedRules);
                setSuccess('規則を追加して保存しました');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '保存に失敗しました');
            }
        } catch (err) {
            setError(err.message);
            setSuccess('');
        } finally {
            setSavingRules(false);
        }
    };

    // 删除规则并自动保存
    const deleteRule = async (id) => {
        const updatedRules = rules.filter(rule => rule.id !== id);
        setRules(updatedRules);

        // 自动保存到数据库
        setSavingRules(true);
        try {
            const response = await fetch('/api/yamatocsv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    city,
                    type,
                    rules: updatedRules
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSavedRules(data.rules || updatedRules);
                setSuccess('規則を削除して保存しました');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '保存に失敗しました');
            }
        } catch (err) {
            setError(err.message);
            setSuccess('');
        } finally {
            setSavingRules(false);
        }
    };

    // 检测文本是否包含乱码
    const hasGarbledText = (text) => {
        const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
        return replacementCharCount > text.length * 0.05;
    };

    // 获取实际分隔符
    const getActualDelimiter = () => {
        if (delimiter === 'custom') {
            if (customDelimiter === '\\tab' || customDelimiter === '/tab') {
                return '\t';
            }
            return customDelimiter || ',';
        }
        return delimiter;
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

                try {
                    text = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
                    if (hasGarbledText(text)) {
                        throw new Error('UTF-8 decoding produced garbled text');
                    }
                } catch (utf8Error) {
                    try {
                        text = new TextDecoder('shift_jis').decode(arrayBuffer);
                        encoding = 'Shift-JIS';
                    } catch (sjisError) {
                        throw new Error('両方のエンコーディング（UTF-8、Shift-JIS）で解読に失敗しました');
                    }
                }

                setInputEncoding(encoding);
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

    // CSV 解析 - 使用自定义分隔符
    const parseCSV = (text) => {
        const actualDelimiter = getActualDelimiter();
        const lines = text.split('\n');
        const result = [];

        for (let line of lines) {
            if (!line.trim()) continue;

            const cells = [];
            let cell = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === actualDelimiter && !inQuotes) {
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
        const actualDelimiter = getActualDelimiter();
        const csvString = data
            .map((row) =>
                row
                    .map((cell) => {
                        const str = String(cell || '');
                        if (str.includes(actualDelimiter) || str.includes('"') || str.includes('\n')) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    })
                    .join(actualDelimiter)
            )
            .join('\n');

        return csvString + '\n';
    };

    // 应用自定义规则处理CSV
    const applyCustomRules = (data) => {
        const processed = data.map((row) => [...row]);

        for (const rule of rules) {
            try {
                applyRule(processed, rule);
            } catch (err) {
                console.error('規則適用エラー:', rule, err);
            }
        }

        return processed;
    };

    // 解析并应用单个规则
    const applyRule = (data, rule) => {
        const { location, action } = rule;

        // 解析定位部分
        const locParts = location.split(/\s+/);
        let targetRows = [];
        let targetCols = [];
        let valueMatch = null;

        for (const part of locParts) {
            if (part.startsWith('行=')) {
                const rowSpec = part.substring(2);
                if (rowSpec.includes('以降')) {
                    const startRow = parseInt(rowSpec.replace('以降', '')) - 1;
                    targetRows = Array.from({ length: data.length - startRow }, (_, i) => i + startRow);
                } else {
                    targetRows = [parseInt(rowSpec) - 1];
                }
            } else if (part.startsWith('列=')) {
                const colSpec = part.substring(2);
                if (colSpec.includes('以降')) {
                    const startCol = parseInt(colSpec.replace('以降', '')) - 1;
                    const maxCols = Math.max(...data.map(r => r.length));
                    targetCols = Array.from(
                        { length: maxCols - startCol },
                        (_, i) => i + startCol
                    );
                } else {
                    targetCols = [parseInt(colSpec) - 1];
                }
            } else if (part.startsWith('値=')) {
                valueMatch = part.substring(2);
            }
        }

        // 如果没有指定行,默认为所有行
        if (targetRows.length === 0) {
            targetRows = Array.from({ length: data.length }, (_, i) => i);
        }

        // 应用操作
        for (const rowIdx of targetRows) {
            if (rowIdx >= data.length) continue;

            if (targetCols.length > 0) {
                // 对特定列操作
                for (const colIdx of targetCols) {
                    applyAction(data, rowIdx, colIdx, action, valueMatch);
                }
            } else {
                // 对整行操作
                applyRowAction(data, rowIdx, action);
            }
        }
    };

    // 应用单元格操作
    const applyAction = (data, rowIdx, colIdx, action, valueMatch) => {
        while (data[rowIdx].length <= colIdx) {
            data[rowIdx].push('');
        }

        const currentValue = String(data[rowIdx][colIdx] ?? '');

        // 如果有值匹配条件但不匹配，直接跳过
        if (valueMatch && !matchValue(currentValue, valueMatch)) {
            return;
        }

        // 计算作用区间
        let start = 0;
        let length = currentValue.length;

        // 解析区间: @q起始位置,字符数
        // 例: @q7,2 表示从第7个字符开始，取2个字符（9位文字的末尾两位）
        if (valueMatch?.startsWith('@q')) {
            const rangeSpec = valueMatch.substring(2);
            const [startStr, lengthStr] = rangeSpec.split(',');

            start = parseInt(startStr) || 0;
            length = parseInt(lengthStr) || 0;

            // 确保不超出范围
            start = Math.max(0, Math.min(start, currentValue.length));
            length = Math.max(0, length);
        }

        const end = Math.min(start + length, currentValue.length);

        // === 操作解析 ===

        // 修正
        if (action.includes('に修正')) {
            const newValue = action.replace('に修正', '');
            data[rowIdx][colIdx] =
                currentValue.substring(0, start) +
                newValue +
                currentValue.substring(end);
            return;
        }

        // 削除
        if (action.includes('を削除')) {
            data[rowIdx][colIdx] =
                currentValue.substring(0, start) +
                currentValue.substring(end);
            return;
        }

        // 挿入
        if (action.includes('を挿入')) {
            const insertValue = action.replace('を挿入', '');
            data[rowIdx][colIdx] =
                currentValue.substring(0, start) +
                insertValue +
                currentValue.substring(start);
            return;
        }
    };

    // 应用行操作
    const applyRowAction = (data, rowIdx, action) => {
        if (action.includes('行を挿入')) {
            const count = parseInt(action.replace('行を挿入', '')) || 1;
            for (let i = 0; i < count; i++) {
                data.splice(rowIdx + 1, 0, []);
            }
        }
    };

    // 值匹配检查
    const matchValue = (value, pattern) => {
        if (pattern.startsWith('@q')) {
            return true; // 区间模式,总是匹配
        }
        return value === pattern;
    };

    // 生成处理后的CSV数据
    const generateProcessedCSV = () => {
        const parsedData = parseCSV(csvData);
        const processedData = applyCustomRules(parsedData);
        const csvString = csvToString(processedData);

        let uint8Array;

        if (inputEncoding === 'Shift-JIS') {
            const unicodeArray = Encoding.stringToCode(csvString);
            const sjisArray = Encoding.convert(unicodeArray, {
                from: 'UNICODE',
                to: 'SJIS'
            });
            uint8Array = new Uint8Array(sjisArray);
        } else {
            // UTF-8
            uint8Array = new TextEncoder().encode(csvString);
        }

        return uint8Array;
    };

    // CSV 导出
    const handleExport = () => {
        try {
            if (!csvData) throw new Error('CSVデータがありません');

            const uint8Array = generateProcessedCSV();
            const blob = new Blob([uint8Array], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `processed_${mode}_${city}_${type}_${Date.now()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setSuccess(`CSVファイルをエクスポートしました\nエンコーディング: ${inputEncoding}`);
            setError('');
        } catch (err) {
            console.error(err);
            setError(err.message || 'CSV処理中にエラーが発生しました');
            setSuccess('');
        }
    };

    // Google Drive に上传
    const handleUploadToDrive = async () => {
        try {
            if (!csvData) throw new Error('CSVデータがありません');

            setIsUploadingToDrive(true);

            // 检查是否已授权
            if (!isGoogleAuthorized) {
                // 触发授权流程
                const authResponse = await fetch('/api/google-drive/authorize');
                if (authResponse.ok) {
                    const { authUrl } = await authResponse.json();
                    window.location.href = authUrl;
                    return;
                }
                throw new Error('Google認証の開始に失敗しました');
            }

            // 生成处理后的CSV
            const uint8Array = generateProcessedCSV();

            // 生成文件名 (与导出文件名一致)
            const uploadFileName = `processed_${mode}_${city}_${type}_${Date.now()}.csv`;

            // 将Uint8Array转换为Base64
            const base64 = btoa(String.fromCharCode(...uint8Array));

            // 上传到Google Drive
            const uploadResponse = await fetch('/api/google-drive/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: uploadFileName,
                    fileData: base64,
                    mimeType: 'text/csv'
                })
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'アップロードに失敗しました');
            }

            const { fileId, webViewLink } = await uploadResponse.json();

            setSuccess(`Google Driveにアップロードしました\nファイル名: ${uploadFileName}`);
            setError('');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Google Driveへのアップロード中にエラーが発生しました');
            setSuccess('');
        } finally {
            setIsUploadingToDrive(false);
        }
    };

    // CSV 预览
    const csvPreview = csvData ? parseCSV(csvData).slice(0, 99) : [];
    const totalRows = csvData ? parseCSV(csvData).length : 0;

    return (
        <div className="bg-style">
            {/* 標題 - 模式切换 */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-4">
                    <h2
                        onClick={() => setMode('yamato')}
                        className={`group relative flex items-center gap-1 text-x2 font-bold cursor-pointer 
                    transition-all duration-300 hover:scale-[1.05]
                    ${mode === 'yamato' ? 'bg-[#FCCF00]' : 'text-black'}`}
                        style={mode === 'yamato' ? { transform: 'translateY(2px)' } : {}}
                    >
                        ヤマト
                        <span
                            className={`inline-block transition-all duration-300 
                        ${mode === 'yamato'
                                    ? 'opacity-100 translate-x-0'
                                    : 'opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0'}`}
                        >
                            <Cat size={28} />
                        </span>
                    </h2>

                    <h2 className="text-x2 font-bold text-black">/</h2>

                    <h2
                        onClick={() => setMode('sagawa')}
                        className={`group relative flex items-center gap-1 text-x2 font-bold cursor-pointer 
                    transition-all duration-300 hover:scale-[1.05]
                    ${mode === 'sagawa' ? 'text-white bg-[#3B499F]' : 'text-black'}`}
                        style={mode === 'sagawa' ? { transform: 'translateY(2px)' } : {}}
                    >
                        佐川
                        <span
                            className={`inline-block transition-all duration-300 
                        ${mode === 'sagawa'
                                    ? 'opacity-100 translate-x-0'
                                    : 'opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0'}`}
                        >
                            <PersonSimpleRun size={28} />
                        </span>
                    </h2>

                    <h2 className="text-x2 font-bold text-black">チェンジ</h2>
                </div>
            </div>

            {/* 上：上传 + 规则 ｜ 下：预览 */}
            <div className="flex flex-col gap-8">

                {/* ================= 上方：文件操作 + 规则 并列 ================= */}
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* 左：文件上传 / 导出 / Drive */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="table-div p-8">

                            {/* 城市 + 类型 */}
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

                            {/* 分隔符选择 */}
                            <div className="mb-6">
                                <div className="flex gap-4 items-center">
                                    <select
                                        value={delimiter}
                                        onChange={(e) => setDelimiter(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded text-sm"
                                    >
                                        <option value=",">,</option>
                                        <option value=";">;</option>
                                        <option value="|">|</option>
                                        <option value="\t">タブ</option>
                                        <option value="custom">カスタム</option>
                                    </select>
                                    <span>で区切り</span>

                                    {delimiter === 'custom' && (
                                        <input
                                            type="text"
                                            maxLength="4"
                                            placeholder="1文字 または /tab"
                                            value={customDelimiter}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (
                                                    val === '' ||
                                                    val.length === 1 ||
                                                    val === '/tab' ||
                                                    val === '\\tab'
                                                ) {
                                                    setCustomDelimiter(val);
                                                }
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded text-sm w-32"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* 文件上传 + 导出 */}
                            <div className="flex flex-wrap items-center gap-6 mb-4">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    className="inputfile-item"
                                />
                                {csvData && (
                                    <>
                                        <button onClick={handleExport} className="orther-button">
                                            エクスポート
                                        </button>
                                        <button
                                            onClick={handleUploadToDrive}
                                            className="orther-button"
                                        >
                                            アップロード
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* 提示 */}
                            <div>
                                {error && <p className="text-red-600">{error}</p>}
                                {success && (
                                    <p className="text-black whitespace-pre-line">{success}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 右：规则设定 + 列表 */}
                    <div className="flex-1">
                        <div className="table-div p-6">

                            {/* 新规则 */}
                            <div className="mb-4 p-4 bg-blue-50 rounded">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-3 border-b border-blue-200 pb-3">

                                        {/* 行条件 */}
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={newRule.rowCondition}
                                                onChange={(e) =>
                                                    setNewRule({
                                                        ...newRule,
                                                        rowCondition: e.target.value,
                                                    })
                                                }
                                                className="px-2 py-1 border border-gray-300 rounded font-bold text-lg"
                                            >
                                                {rowConditions.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt || '行指定なし'}
                                                    </option>
                                                ))}
                                            </select>

                                            {newRule.rowCondition && (
                                                <input
                                                    type="text"
                                                    placeholder="値"
                                                    value={newRule.rowValue}
                                                    onChange={(e) =>
                                                        setNewRule({
                                                            ...newRule,
                                                            rowValue: e.target.value,
                                                        })
                                                    }
                                                    className="px-2 py-1 border border-gray-300 rounded font-bold text-lg w-20"
                                                />
                                            )}
                                        </div>

                                        {/* 列条件 */}
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={newRule.colCondition}
                                                onChange={(e) =>
                                                    setNewRule({
                                                        ...newRule,
                                                        colCondition: e.target.value,
                                                    })
                                                }
                                                className="px-2 py-1 border border-gray-300 rounded font-bold text-lg"
                                            >
                                                {colConditions.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt || '列指定なし'}
                                                    </option>
                                                ))}
                                            </select>

                                            {newRule.colCondition && (
                                                <input
                                                    type="text"
                                                    placeholder="値"
                                                    value={newRule.colValue}
                                                    onChange={(e) =>
                                                        setNewRule({
                                                            ...newRule,
                                                            colValue: e.target.value,
                                                        })
                                                    }
                                                    className="px-2 py-1 border border-gray-300 rounded font-bold text-lg w-20"
                                                />
                                            )}
                                        </div>

                                        {/* 值条件 */}
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={newRule.valueCondition}
                                                onChange={(e) =>
                                                    setNewRule({
                                                        ...newRule,
                                                        valueCondition: e.target.value,
                                                    })
                                                }
                                                className="px-2 py-1 border border-gray-300 rounded font-bold text-lg"
                                            >
                                                {valueConditions.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt || '値指定なし'}
                                                    </option>
                                                ))}
                                            </select>

                                            {newRule.valueCondition === '値=' && (
                                                <input
                                                    type="text"
                                                    placeholder="値"
                                                    value={newRule.valueValue}
                                                    onChange={(e) =>
                                                        setNewRule({
                                                            ...newRule,
                                                            valueValue: e.target.value,
                                                        })
                                                    }
                                                    className="px-2 py-1 border border-gray-300 rounded font-bold text-lg w-20"
                                                />
                                            )}

                                            {newRule.valueCondition === '値=@q' && (
                                                <>
                                                    <input
                                                        type="text"
                                                        placeholder="位置"
                                                        value={newRule.valueStart}
                                                        onChange={(e) =>
                                                            setNewRule({
                                                                ...newRule,
                                                                valueStart: e.target.value,
                                                            })
                                                        }
                                                        className="px-2 py-1 border border-gray-300 rounded font-bold text-lg w-16"
                                                    />
                                                    <span>,</span>
                                                    <input
                                                        type="text"
                                                        placeholder="文字数"
                                                        value={newRule.valueLength}
                                                        onChange={(e) =>
                                                            setNewRule({
                                                                ...newRule,
                                                                valueLength: e.target.value,
                                                            })
                                                        }
                                                        className="px-2 py-1 border border-gray-300 rounded font-bold text-lg w-16"
                                                    />
                                                </>
                                            )}
                                        </div>

                                        <span className="text-lg font-bold">のを</span>

                                        {/* 操作 */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="値"
                                                value={newRule.actionValue}
                                                onChange={(e) =>
                                                    setNewRule({
                                                        ...newRule,
                                                        actionValue: e.target.value,
                                                    })
                                                }
                                                className="px-2 py-1 border border-gray-300 rounded font-bold text-lg w-32"
                                            />
                                            <select
                                                value={newRule.actionType}
                                                onChange={(e) =>
                                                    setNewRule({
                                                        ...newRule,
                                                        actionType: e.target.value,
                                                    })
                                                }
                                                className="px-2 py-1 border border-gray-300 rounded font-bold text-lg"
                                            >
                                                {actionTypes.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button onClick={addRule} className="save-button">
                                            保存
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 规则列表 */}
                            <div className="space-y-2">
                                {rules.length === 0 ? (
                                    <p className="text-gray-500 text-sm">ルールがありません</p>
                                ) : (
                                    rules.map((rule) => (
                                        <div
                                            key={rule.id}
                                            className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded"
                                        >
                                            <div className="flex-1 text-sm">
                                                <span className="font-medium text-blue-600">
                                                    {rule.location}
                                                </span>
                                                <span className="mx-2 text-gray-400">のを</span>
                                                <span className="font-medium text-green-600">
                                                    {rule.action}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => deleteRule(rule.id)}
                                                disabled={savingRules}
                                                className="x-button"
                                            >
                                                <X size={20} weight="bold" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= 下方：CSV プレビュー ================= */}
                <div className="w-full table-div p-8 max-h-[700px] overflow-auto">
                    <div className="mb-4 pb-2 border-b border-gray-300">
                        <h3 className="text-2lg font-semibold">プレビュー</h3>
                        {csvData && (
                            <p className="text-sm text-gray-600 mt-1">
                                総 {totalRows}行{' '}
                                {csvPreview.length < totalRows &&
                                    `（${csvPreview.length}行まで表示）`}
                            </p>
                        )}
                    </div>

                    <table className="min-w-full table-auto border-collapse whitespace-nowrap">
                        <tbody>
                            {csvPreview.map((row, i) => (
                                <tr key={i} className="table-details-content">
                                    {row.map((cell, j) => (
                                        <td
                                            key={j}
                                            className="px-2 py-1 border-r last:border-r-0"
                                        >
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