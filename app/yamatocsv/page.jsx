'use client';

import { useState, useEffect } from 'react';
import { PersonSimpleRun, Cat, X, Trash, ArrowFatLinesDown, WarningCircle } from "phosphor-react";
import Encoding from 'encoding-japanese';
import * as XLSX from 'xlsx'; // 依然保留,虽然现在主要用数字索引,但以后可能用到导出功能

export default function CSVProcessor() {
    const cities = ['tokyo', 'osaka'];
    const types = ['yotei', 'kakutei'];

    // 状态管理
    const [mode, setMode] = useState('yamato');
    const [city, setCity] = useState('tokyo');
    const [type, setType] = useState('yotei');

    const [csvData, setCsvData] = useState('');
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [processedCsvData, setProcessedCsvData] = useState('');
    const [isProcessed, setIsProcessed] = useState(false);

    // CSV分隔符设置
    const [delimiter, setDelimiter] = useState(',');
    const [customDelimiter, setCustomDelimiter] = useState('');

    // Google Drive 相关
    const [isGoogleAuthorized, setIsGoogleAuthorized] = useState(false);
    const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

    // === 自定义规则相关状态 (新版结构) ===
    const [rules, setRules] = useState([]);

    // 编辑中的规则状态
    const [editingRule, setEditingRule] = useState({
        name: "",
        // 条件组 (AND关系)
        conditions: [
            { col: 1, operator: "equals", value: "" } // col: 1 (代表第1列)
        ],
        // 执行动作组 (新增:支持多动作)
        actions: [
            { type: "set_value", targetCol: 2, value: "" } // targetCol: 2 (代表第2列)
        ]
    });

    const [loadingRules, setLoadingRules] = useState(false);
    const [savingRules, setSavingRules] = useState(false);
    const [inputEncoding, setInputEncoding] = useState('UTF-8');

    // 加载规则
    useEffect(() => {
        loadRules();
    }, [mode, city, type]);

    useEffect(() => {
        checkGoogleAuth();
    }, []);

    // 当上传新文件时，重置转换状态
    useEffect(() => {
        setIsProcessed(false);
        setProcessedCsvData('');
    }, [csvData]);

    const checkGoogleAuth = async () => {
        try {
            const response = await fetch('/api/google-drive/auth-status');
            if (response.ok) {
                const data = await response.json();
                setIsGoogleAuthorized(data.authorized);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadRules = async () => {
        setLoadingRules(true);
        try {
            const response = await fetch(`/api/yamatocsv?mode=${mode}&city=${city}&type=${type}`);
            if (response.ok) {
                const data = await response.json();
                // 兼容旧数据:如果后端返回的是旧格式,这里可能需要做一层转换,或者直接由用户重建规则
                // 这里假设新保存的规则都包含 actions 数组
                setRules(Array.isArray(data.rules) ? data.rules : []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingRules(false);
        }
    };

    // === 规则编辑逻辑 (UI交互) ===

    // -- 条件部分 --
    const addCondition = () => {
        setEditingRule(prev => ({
            ...prev,
            conditions: [...prev.conditions, { col: 1, operator: "contains", value: "" }]
        }));
    };

    const removeCondition = (index) => {
        const newConditions = editingRule.conditions.filter((_, i) => i !== index);
        setEditingRule(prev => ({ ...prev, conditions: newConditions }));
    };

    const updateCondition = (index, field, value) => {
        const newConditions = [...editingRule.conditions];
        // 如果是列输入,转为数字
        const finalValue = field === 'col' ? (parseInt(value) || 1) : value;
        newConditions[index] = { ...newConditions[index], [field]: finalValue };
        setEditingRule(prev => ({ ...prev, conditions: newConditions }));
    };

    // -- 动作部分 (新增) --
    const addAction = () => {
        setEditingRule(prev => ({
            ...prev,
            actions: [...prev.actions, { type: "set_value", targetCol: 1, value: "" }]
        }));
    };

    const removeAction = (index) => {
        const newActions = editingRule.actions.filter((_, i) => i !== index);
        setEditingRule(prev => ({ ...prev, actions: newActions }));
    };

    const updateAction = (index, field, value) => {
        const newActions = [...editingRule.actions];

        // 切换 action 类型时,重置结构
        if (field === 'type') {
            if (value === 'set_value') {
                newActions[index] = {
                    type: 'set_value',
                    targetCol: 1,
                    value: ''
                };
            } else if (value === 'insert_prefix') {
                newActions[index] = {
                    type: 'insert_prefix',
                    targetCol: 1,
                    value: ''
                };
            } else if (value === 'delete_chars') {
                newActions[index] = {
                    type: 'delete_chars',
                    targetCol: 1,
                    startPos: 1,
                    mode: 'to_end'
                };
            } else if (value === 'delete_row') {
                newActions[index] = {
                    type: 'delete_row'
                };
            }

            setEditingRule(prev => ({ ...prev, actions: newActions }));
            return;
        }

        // 普通字段更新
        const finalValue =
            field === 'targetCol' || field === 'startPos' || field === 'length'
                ? (parseInt(value) || 1)
                : value;

        newActions[index] = { ...newActions[index], [field]: finalValue };
        setEditingRule(prev => ({ ...prev, actions: newActions }));
    };

    // 保存规则
    const saveRule = async () => {
        if (!editingRule.name) {
            setError("ルール名を入力してください");
            return;
        }

        // 1. 预处理:将用户输入的 1-based 索引转换为 0-based 索引以便代码处理
        const processedConditions = editingRule.conditions.map(c => ({
            ...c,
            colIndex: Math.max(0, (c.col || 1) - 1) // 输入1 -> 索引0
        }));

        const processedActions = editingRule.actions.map(a => ({
            ...a,
            targetColIndex: Math.max(0, (a.targetCol || 1) - 1) // 输入1 -> 索引0
        }));

        const newRuleItem = {
            id: Date.now().toString(),
            name: editingRule.name,
            conditions: processedConditions,
            actions: processedActions, // 保存为数组
            // 保留原始输入用于回显(可选,这里直接用处理后的数据反推也可以,为简化逻辑直接存)
            ui: {
                conditions: editingRule.conditions,
                actions: editingRule.actions
            }
        };

        const updatedRules = [...rules, newRuleItem];
        setRules(updatedRules);

        // 重置表单
        setEditingRule({
            name: "",
            conditions: [{ col: 1, operator: "equals", value: "" }],
            actions: [{ type: "set_value", targetCol: 2, value: "" }]
        });
        setError('');

        // 自动保存到后端
        await persistRules(updatedRules);
    };

    // 删除规则
    const deleteRule = async (id) => {
        const updatedRules = rules.filter(rule => rule.id !== id);
        setRules(updatedRules);
        await persistRules(updatedRules);
    };

    const persistRules = async (newRules) => {
        setSavingRules(true);
        try {
            const response = await fetch('/api/yamatocsv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode, city, type,
                    rules: newRules
                })
            });

            if (response.ok) {
                setSuccess('規則を保存しました');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '保存に失敗しました');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingRules(false);
        }
    };

    // === 文件处理与规则应用逻辑 ===

    const hasGarbledText = (text) => {
        const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
        return replacementCharCount > text.length * 0.05;
    };

    const getActualDelimiter = () => {
        if (delimiter === 'custom') {
            if (customDelimiter === '\\tab' || customDelimiter === '/tab') return '\t';
            return customDelimiter || ',';
        }
        return delimiter;
    };

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
                    if (hasGarbledText(text)) throw new Error('Garbled');
                } catch {
                    try {
                        text = new TextDecoder('shift_jis').decode(arrayBuffer);
                        encoding = 'Shift-JIS';
                    } catch {
                        throw new Error('エンコーディングエラー');
                    }
                }
                setInputEncoding(encoding);
                setCsvData(text);
                setFileName(file.name);
                setSuccess(`読み込み成功: ${encoding}`);
                setError('');
            } catch (err) {
                setError('CSV読み込み失敗');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const parseCSV = (text) => {
        const actualDelimiter = getActualDelimiter();
        const lines = text.split('\n');
        const result = [];
        for (let line of lines) {
            if (!line.trim()) continue;
            const row = line.split(actualDelimiter).map(cell => cell.replace(/^"|"$/g, ''));
            result.push(row);
        }
        return result;
    };

    const csvToString = (data) => {
        const actualDelimiter = getActualDelimiter();
        return data.map(row =>
            row.map(cell => {
                const str = String(cell || '');
                return (str.includes(actualDelimiter) || str.includes('\n')) ? `"${str}"` : str;
            }).join(actualDelimiter)
        ).join('\n') + '\n';
    };

    // ★★★ 核心:应用规则逻辑 (支持多动作) ★★★
    const applyCustomRules = (data) => {
        let processed = data.map(row => [...row]);

        // 1. 过滤:检查是否需要删除行
        processed = processed.filter((row) => {
            // 遍历所有规则
            for (const rule of rules) {
                // 检查是否匹配条件
                if (checkConditions(row, rule.conditions)) {
                    // 检查该规则的动作中是否有"删除行"
                    // 兼容性处理:rule.actions (新) 或 rule.action (旧)
                    const actions = rule.actions || (rule.action ? [rule.action] : []);
                    const hasDelete = actions.some(a => a.type === 'delete_row');
                    if (hasDelete) return false; // 只要命中一个删除规则,该行就不要了
                }
            }
            return true; // 保留
        });

        // 2. 修改:应用值变更
        processed.forEach((row) => {
            rules.forEach(rule => {
                if (checkConditions(row, rule.conditions)) {
                    const actions = rule.actions || (rule.action ? [rule.action] : []);
                    actions.forEach(action => {
                        if (action.type !== 'delete_row') {
                            applyActionToRow(row, action);
                        }
                    });
                }
            });
        });

        return processed;
    };

    const checkConditions = (row, conditions) => {
        if (!conditions || conditions.length === 0) return true;

        return conditions.every(cond => {
            // cond.colIndex 是 0-based
            const cellValue = String(row[cond.colIndex] || "");
            switch (cond.operator) {
                case 'all': return true;
                case 'equals': return cellValue === cond.value;
                case 'not_equals': return cellValue !== cond.value;
                case 'contains': return cellValue.includes(cond.value);
                case 'startsWith': return cellValue.startsWith(cond.value);
                default: return false;
            }
        });
    };

    const applyActionToRow = (row, action) => {
        const targetIdx = action.targetColIndex; // 0-based
        while (row.length <= targetIdx) row.push(""); // 补全数组

        if (action.type === 'set_value') {
            row[targetIdx] = action.value;
        } else if (action.type === 'replace_text') {
            row[targetIdx] = String(row[targetIdx]).replace(action.value, '');
        } else if (action.type === 'insert_prefix') {
            row[targetIdx] = action.value + row[targetIdx];
        } else if (action.type === 'delete_chars') {
            const start = Math.max(0, (action.startPos || 1) - 1);
            const str = String(row[targetIdx] || '');

            if (action.mode === 'len') {
                const len = Number(action.length) || 0;
                row[targetIdx] = str.slice(0, start) + str.slice(start + len);
            } else {
                // to_end
                row[targetIdx] = str.slice(0, start);
            }
        }
    };

    // === 转换功能 ===
    const handleConvert = () => {
        try {
            if (!csvData) {
                setError('CSVデータがありません');
                return;
            }

            const parsedData = parseCSV(csvData);
            const processedData = applyCustomRules(parsedData);
            const csvString = csvToString(processedData);

            setProcessedCsvData(csvString);
            setIsProcessed(true);
            setSuccess('変換完了しました');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('変換エラー');
        }
    };

    // === 导出与上传 ===
    const generateOutputCSV = () => {
        let csvString;

        if (isProcessed) {
            // 使用已转换的数据
            csvString = processedCsvData;
        } else {
            // 使用原始数据
            csvString = csvData;
        }

        let uint8Array;
        if (inputEncoding === 'Shift-JIS') {
            const unicodeArray = Encoding.stringToCode(csvString);
            const sjisArray = Encoding.convert(unicodeArray, { from: 'UNICODE', to: 'SJIS' });
            uint8Array = new Uint8Array(sjisArray);
        } else {
            uint8Array = new TextEncoder().encode(csvString);
        }
        return uint8Array;
    };

    const generateFileName = () => {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

        // 去除原文件的扩展名
        const baseFileName = fileName.replace(/\.csv$/i, '');
        return `${baseFileName}_${timestamp}.csv`;
    };

    const handleExport = () => {
        try {
            if (!csvData) throw new Error('CSVデータがありません');
            const uint8Array = generateOutputCSV();
            const blob = new Blob([uint8Array], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = generateFileName();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            setError('CSV処理エラー');
        }
    };

    const handleUploadToDrive = async () => {
        try {
            if (!csvData) throw new Error('CSVデータがありません');
            setIsUploadingToDrive(true);
            if (!isGoogleAuthorized) {
                const authResponse = await fetch('/api/google-drive/authorize');
                if (authResponse.ok) {
                    const { authUrl } = await authResponse.json();
                    window.location.href = authUrl;
                    return;
                }
                throw new Error('Google認証失敗');
            }
            const uint8Array = generateOutputCSV();
            const uploadFileName = generateFileName();
            const base64 = btoa(String.fromCharCode(...uint8Array));
            const uploadResponse = await fetch('/api/google-drive/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: uploadFileName,
                    fileData: base64,
                    mimeType: 'text/csv'
                })
            });
            if (!uploadResponse.ok) throw new Error('アップロード失敗');
            setSuccess(`Google Driveにアップロードしました: ${uploadFileName}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsUploadingToDrive(false);
        }
    };

    const csvPreview = csvData ? parseCSV(csvData).slice(0, 99) : [];
    const totalRows = csvData ? parseCSV(csvData).length : 0;

    return (
        <div className="bg-style">
            {/* 顶部:模式切换 */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-4">
                    <h2 onClick={() => setMode('yamato')} className={`group relative flex items-center gap-1 text-x2 font-bold cursor-pointer transition-all duration-300 hover:scale-[1.05] ${mode === 'yamato' ? 'bg-[#FCCF00]' : 'text-black'}`}>
                        ヤマト <span className={`inline-block transition-all duration-300 ${mode === 'yamato' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0'}`}><Cat size={28} /></span>
                    </h2>
                    <h2 className="text-x2 font-bold text-black">/</h2>
                    <h2 onClick={() => setMode('sagawa')} className={`group relative flex items-center gap-1 text-x2 font-bold cursor-pointer transition-all duration-300 hover:scale-[1.05] ${mode === 'sagawa' ? 'text-white bg-[#3B499F]' : 'text-black'}`}>
                        佐川 <span className={`inline-block transition-all duration-300 ${mode === 'sagawa' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0'}`}><PersonSimpleRun size={28} /></span>
                    </h2>
                </div>
            </div>

            <div className="flex flex-col gap-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* 左侧:文件上传与设置 */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="table-div p-8">
                            <div className="flex flex-wrap gap-16 mb-6">
                                <div>
                                    <div className="flex gap-6">
                                        {cities.map((c) => (
                                            <label key={c} className="flex items-center gap-1">
                                                <input type="radio" name="city" value={c} checked={city === c} onChange={() => setCity(c)} className="mr-1" />
                                                {c === 'tokyo' ? '東京' : '大阪'}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex gap-6">
                                        {types.map((t) => (
                                            <label key={t} className="flex items-center gap-1">
                                                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="mr-1" />
                                                {t === 'yotei' ? '予定' : '確定'}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="flex gap-4 items-center">
                                    <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm">
                                        <option value=",">,</option>
                                        <option value=";">;</option>
                                        <option value="|">|</option>
                                        <option value="\t">タブ</option>
                                        <option value="custom">カスタム</option>
                                    </select>
                                    <span>で区切り</span>
                                    {delimiter === 'custom' && (
                                        <input type="text" maxLength="4" placeholder="/tab" value={customDelimiter} onChange={(e) => setCustomDelimiter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm w-32" />
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-start gap-4 mb-4">
                                <div>
                                    <input type="file" accept=".csv" onChange={handleFileUpload} className="inputfile-item mb-2" />
                                </div>
                                <div>
                                    {error && <p className="text-red-600 flex items-center gap-2"><WarningCircle size={20} /> {error}</p>}
                                    {success && <p className="text-black whitespace-pre-line">{success}</p>}
                                </div>
                                {csvData && (
                                    <>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={handleConvert}
                                                className={`orther-button ${isProcessed ? 'bg-green-500 text-white' : ''}`}
                                            >
                                                {isProcessed ? '変換済み' : '変換'}
                                            </button>
                                            <button onClick={handleExport} className="orther-button">エクスポート</button>
                                            <button onClick={handleUploadToDrive} className="orther-button">GoogleDriveへアップロード</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ★★★ 右侧:规则设定 ★★★ */}
                    <div className="flex-1">
                        <div className="table-div p-6 bg-white">

                            {/* 新增规则面板 */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                                <input
                                    type="text"
                                    className="w-full input-item"
                                    placeholder="メモ"
                                    value={editingRule.name}
                                    onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                                />

                                {/* 1. 条件区域 (IF) */}
                                <div className="mb-3 mt-5">
                                    <div className="text-xs font-bold text-gray-500 mb-1">条件 (IF) - AND条件</div>
                                    <div className="space-y-2">
                                        {editingRule.conditions.map((cond, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <div className="relative w-20">
                                                    <input
                                                        type="number" min="1"
                                                        className="w-full input-item"
                                                        value={cond.col}
                                                        onChange={e => updateCondition(idx, 'col', e.target.value)}
                                                    />
                                                    <span className="absolute right-1 top-3 text-[10px] text-gray-400">列目</span>
                                                </div>
                                                <select
                                                    className="p-1 border rounded text-sm flex-1"
                                                    value={cond.operator}
                                                    onChange={e => updateCondition(idx, 'operator', e.target.value)}
                                                >
                                                    <option value="equals">と等しい (=)</option>
                                                    <option value="contains">を含む</option>
                                                    <option value="not_equals">と等しくない (!=)</option>
                                                    <option value="startsWith">で始まる</option>
                                                    <option value="all">すべて(条件なし)</option>
                                                </select>
                                                {cond.operator !== 'all' && (
                                                    <input
                                                        type="text"
                                                        className="flex-1 input-item"
                                                        placeholder="値"
                                                        value={cond.value}
                                                        onChange={e => updateCondition(idx, 'value', e.target.value)}
                                                    />
                                                )}
                                                {editingRule.conditions.length > 1 && (
                                                    <button onClick={() => removeCondition(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                                        <Trash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button onClick={addCondition} className="text-2xl font-bold plus-button">
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-center my-2">
                                    <ArrowFatLinesDown size={24} weight="bold" />
                                </div>

                                {/* 2. 动作区域 (THEN) - 允许多个动作 */}
                                <div className="mb-4">
                                    <div className="text-xs font-bold text-gray-500 mb-1">操作 (THEN)</div>
                                    <div className="space-y-2">
                                        {editingRule.actions.map((act, idx) => (
                                            <div key={idx} className="flex flex-col gap-2 bg-white p-2 rounded border border-gray-200">
                                                <div className="flex gap-2 items-center">
                                                    <select
                                                        className="flex-1 p-1 border rounded text-sm bg-gray-50"
                                                        value={act.type}
                                                        onChange={e => updateAction(idx, 'type', e.target.value)}
                                                    >
                                                        <option value="set_value">値を変更 (Set)</option>
                                                        <option value="delete_chars">文字を削除</option>
                                                        <option value="delete_row">行を削除 (Delete Row)</option>
                                                        <option value="insert_prefix">接頭辞を追加 (Prefix)</option>
                                                    </select>
                                                    {editingRule.actions.length > 1 && (
                                                        <button onClick={() => removeAction(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                                            <Trash size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* 普通动作(set / prefix) */}
                                                {act.type !== 'delete_row' && act.type !== 'delete_chars' && (
                                                    <div className="flex gap-2 items-center">
                                                        <div className="relative w-20">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="w-full input-item"
                                                                value={act.targetCol}
                                                                onChange={e => updateAction(idx, 'targetCol', e.target.value)}
                                                            />
                                                            <span className="absolute right-1 top-3 text-[10px] text-gray-400">列目</span>
                                                        </div>
                                                        <span className="text-gray-400">➜</span>
                                                        <input
                                                            type="text"
                                                            className="flex-1 input-item"
                                                            placeholder="新しい値"
                                                            value={act.value}
                                                            onChange={e => updateAction(idx, 'value', e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                                {act.type === 'delete_chars' && (
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <div className="relative w-20">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="w-full input-item"
                                                                value={act.targetCol}
                                                                onChange={e => updateAction(idx, 'targetCol', e.target.value)}
                                                            />
                                                            <span className="absolute right-1 top-3 text-[10px] text-gray-400">列目</span>
                                                        </div>

                                                        <span>第</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-20 input-item"
                                                            value={act.startPos || ''}
                                                            onChange={e => updateAction(idx, 'startPos', e.target.value)}
                                                        />
                                                        <span>位から</span>

                                                        <select
                                                            className="p-1 border rounded text-sm"
                                                            value={act.mode || 'to_end'}
                                                            onChange={e => updateAction(idx, 'mode', e.target.value)}
                                                        >
                                                            <option value="to_end">末尾まで削除</option>
                                                            <option value="len">文字数指定</option>
                                                        </select>

                                                        {act.mode === 'len' && (
                                                            <>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    className="w-20 input-item"
                                                                    value={act.length || ''}
                                                                    onChange={e => updateAction(idx, 'length', e.target.value)}
                                                                />
                                                                <span>文字</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        <button onClick={addAction} className="text-2xl plus-button font-bold">
                                            +
                                        </button>
                                    </div>
                                </div>

                                <button onClick={saveRule} className="save-button">
                                    保存
                                </button>
                            </div>

                            {/* 规则列表展示 */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {rules.length === 0 ? (
                                    <p className="text-gray-400 text-sm text-center py-4 border dashed border-gray-300 rounded">ルールなし</p>
                                ) : (
                                    rules.map((rule) => (
                                        <div key={rule.id} className="bg-white border border-gray-200 rounded p-3 shadow-sm hover:shadow-md transition-shadow relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-sm text-gray-800">{rule.name}</span>
                                                <button onClick={() => deleteRule(rule.id)} className="x-button">
                                                    <X size={16} weight="bold" />
                                                </button>
                                            </div>
                                            <div className="text-xs space-y-1">
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="bg-gray-100 text-gray-600 px-1 rounded">IF</span>
                                                    {rule.conditions && rule.conditions.length > 0 ? rule.conditions.map((c, i) => (
                                                        <span key={i} className="bg-yellow-50 text-yellow-800 border border-yellow-100 px-1 rounded">
                                                            {/* c.col 是旧数据结构或ui结构, c.colIndex 是内部逻辑结构. 显示时加1 */}
                                                            {c.colIndex + 1}列目 {c.operator === 'equals' ? '=' : 'in'} "{c.value}"
                                                        </span>
                                                    )) : <span>全ての行</span>}
                                                </div>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <span className="bg-gray-100 text-gray-600 px-1 rounded">THEN</span>
                                                    </div>
                                                    {/* 兼容actions数组或单action对象 */}
                                                    {(rule.actions || (rule.action ? [rule.action] : [])).map((act, k) => (
                                                        <div key={k} className="pl-4">
                                                            {act.type === 'delete_row' ? (
                                                                <span className="text-red-600 font-bold bg-red-50 px-1 rounded">行を削除</span>
                                                            ) : (
                                                                <span className="text-green-700 bg-green-50 px-1 rounded">
                                                                    {act.targetColIndex + 1}列目 ➜ {act.value}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 下方:CSV プレビュー */}
                <div className="w-full table-div p-8 max-h-[700px] overflow-auto">
                    <div className="mb-4 pb-2 border-b border-gray-300">
                        <h3 className="text-2lg font-semibold">プレビュー</h3>
                        {csvData && <p className="text-sm text-gray-600 mt-1">総 {totalRows}行 {csvPreview.length < totalRows && `(${csvPreview.length}行まで表示)`}</p>}
                    </div>
                    <table className="min-w-full table-auto border-collapse whitespace-nowrap">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                {csvPreview.length > 0 && csvPreview[0].map((_, i) => (
                                    <th key={i} className="px-2 py-1 border font-medium text-gray-500 text-center w-12 bg-gray-50">
                                        <span className="font-bold text-gray-700">{i + 1}列目</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {csvPreview.map((row, i) => (
                                <tr key={i} className="table-details-content">
                                    {row.map((cell, j) => (
                                        <td key={j} className="px-2 py-1 border-r border-b last:border-r-0 border-gray-200">{cell}</td>
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