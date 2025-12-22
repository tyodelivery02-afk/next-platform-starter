'use client';

import React, { useState, useEffect, useRef } from 'react';
import ConfirmModal from "components/confirm";
import AlertModal from "components/alert";
import WarningModal from "components/warning";
import LoadingModal from "components/loading";
import { companies, personList } from 'app/config/config';

const InventoryManagement = () => {
    const [inventory, setInventory] = useState(0);
    const [addition, setAddition] = useState('');
    const [updateDate, setUpdateDate] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [deliveryCount, setDeliveryCount] = useState('');
    const [company, setCompany] = useState('');
    const [recipient, setRecipient] = useState('');
    const [person, setPerson] = useState('');
    const [records, setRecords] = useState([]);
    const [resetValue, setResetValue] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Loading...");
    const alertRef = useRef();
    const warningRef = useRef();

    // 初始化：加载库存和记录
    useEffect(() => {
        loadInventoryStatus();
        loadDeliveryRecords();
    }, []);

    const loadInventoryStatus = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/fuzaihyou/status');
            const data = await response.json();
            setInventory(data.current_count || 0);
            if (data.last_updated) {
                const date = new Date(data.last_updated);
                setUpdateDate(`${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`);
            }
        } catch (error) {
            warningRef.current?.open({ message: 'Failed to load inventory status:', error });
        } finally {
            setLoading(false);
        }
    };

    const loadDeliveryRecords = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/fuzaihyou/delivery");
            const data = await response.json();
            setRecords(data);
        } catch (error) {
            warningRef.current?.open({ message: 'Failed to load delivery records:', error });
        } finally {
            setLoading(false);
        }
    };

    const getCurrentDate = () => {
        const now = new Date();
        return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    };

    // 库存更新函数
    const handleInventoryUpdate = async () => {
        // 检查是否有输入
        if (!addition && !resetValue) {
            warningRef.current?.open({ message: '追加枚数またはリセット値を入力してください' });
            return;
        }

        // 检查是否同时输入了两个值
        if (addition && resetValue) {
            warningRef.current?.open({ message: '追加枚数またはリセット値のいずれか一方のみを入力してください' });
            return;
        }

        let operationType, value;

        if (addition) {
            operationType = 'add';
            value = parseInt(addition);
            if (isNaN(value) || value <= 0) {
                warningRef.current?.open({ message: '有効な追加枚数を入力してください' });
                return;
            }
        } else {
            operationType = 'reset';
            value = parseInt(resetValue);
            if (isNaN(value) || value < 0) {
                warningRef.current?.open({ message: '有効なリセット値を入力してください' });
                return;
            }
        }

        setLoadingMessage("Executing...");
        setLoading(true);
        try {
            const response = await fetch("/api/fuzaihyou/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    operationType,
                    value
                })
            });
            const data = await response.json();
            if (response.ok) {
                setInventory(data.new_count);
                setUpdateDate(getCurrentDate());
                setAddition('');
                setResetValue('');
                alertRef.current?.open({ message: "保存成功！" });
            } else {
                alertRef.current?.open({ message: "保存失敗！" });
            }
        } catch (error) {
            warningRef.current?.open({ message: 'Failed to update inventory:', error });
            alertRef.current?.open({ message: "保存失敗！" });
        } finally {
            setLoading(false);
        }
    };

    // 引渡保存函数
    const handleDeliverySave = async () => {
        if (!deliveryDate || !deliveryCount || !company) {
            warningRef.current?.open({ message: '日付、引渡枚数、引渡先を入力してください' });
            return;
        }

        const count = parseInt(deliveryCount);
        if (isNaN(count) || count <= 0) {
            warningRef.current?.open({ message: '有効な引渡枚数を入力してください' });
            return;
        }

        if (count > inventory) {
            warningRef.current?.open({ message: '引渡枚数は在庫枚数以下で入力してください' });
            return;
        }

        setLoadingMessage("Executing...");
        setLoading(true);
        try {
            const response = await fetch("/api/fuzaihyou/delivery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deliveryDate,
                    deliveryCount: count,
                    company,
                    recipient,
                    person
                })
            });
            const data = await response.json();

            if (response.ok) {
                setInventory(data.new_inventory_count);
                await loadDeliveryRecords();

                // 清空输入
                setDeliveryDate('');
                setDeliveryCount('');
                setCompany('');
                setRecipient('');
                setPerson('');
                alertRef.current?.open({ message: "保存成功！" });
            } else {
                alertRef.current?.open({ message: "保存失敗！" });
            }
        } catch (error) {
            warningRef.current?.open({ message: 'Failed to save delivery record:', error });
            alertRef.current?.open({ message: "保存失敗！" });
        } finally {
            setLoading(false);
        }
    };

    // 按月分组记录
    const getRecordsByMonth = () => {
        const grouped = {};

        records.forEach(record => {
            const date = new Date(record.delivery_date);
            const monthKey = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!grouped[monthKey]) {
                grouped[monthKey] = [];
            }
            grouped[monthKey].push(record);
        });

        return grouped;
    };

    // 计算每月每个公司的统计
    const getMonthStats = (monthRecords) => {
        const stats = {};
        companies.forEach(comp => {
            stats[comp] = 0;
        });

        monthRecords.forEach(record => {
            if (stats[record.company] !== undefined) {
                stats[record.company] += record.delivery_count;
            }
        });

        const total = monthRecords.reduce((sum, r) => sum + r.delivery_count, 0);

        return { stats, total };
    };

    const recordsByMonth = getRecordsByMonth();
    const sortedMonths = Object.keys(recordsByMonth).sort().reverse();

    // 按月分页
    const monthsPerPage = 20;
    const totalPages = Math.ceil(sortedMonths.length / monthsPerPage);
    const startIndex = (currentPage - 1) * monthsPerPage;
    const endIndex = startIndex + monthsPerPage;
    const paginatedMonths = sortedMonths.slice(startIndex, endIndex);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
        <div className="bg-style">
            <div className="flex justify-between items-center mb-6">
                <h2 className="relative text-x2 font-bold text-black text-shadow">
                    不在票在庫管理
                </h2>
            </div>

            {/* 在库枚数管理区域 */}
            <div className="mb-8">
                {/* --------------- 第 1 行：在庫 --------------- */}
                <div className="mb-5 text-xl font-semibold">
                    在庫 <span className="font-semibold text-3xl text-yellow-600">{inventory}</span> 枚
                </div>

                {/* --------------- 第 2 行：追加 OR リセット --------------- */}
                <div className="mb-4 flex items-center gap-4">
                    {/* 追加 */}
                    <div className="flex items-end space-x-1 whitespace-nowrap">
                        <input
                            type="number"
                            min="0"
                            value={addition}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || parseFloat(value) >= 0) {
                                    setAddition(value);
                                    if (value) setResetValue('');
                                }
                            }}
                            disabled={!!resetValue}
                            className="w-64 px-3 py-2 input-item disabled:bg-gray-200"
                        />
                        <span className="text-lg">枚を追加</span>
                    </div>

                    {/* OR */}
                    <span className="text-lg font-semibold">OR</span>

                    {/* リセット */}
                    <div className="flex items-end space-x-1 whitespace-nowrap">
                        <input
                            type="number"
                            min="0"
                            value={resetValue}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || parseFloat(value) >= 0) {
                                    setResetValue(value);
                                    if (value) setAddition('');
                                }
                            }}
                            disabled={!!addition}
                            className="w-64 px-3 py-2 input-item disabled:bg-gray-200"
                        />
                        <span className="text-lg">枚にリセット</span>
                    </div>
                </div>

                {/* --------------- 第 3 行：保存ボタン --------------- */}
                <div className="mb-4">
                    <ConfirmModal
                        onConfirm={handleInventoryUpdate}
                        buttonText="保存"
                        message="保存しますか"
                        buttonColor="save-button"
                    />
                    <span className="px-3 py-2 rounded-md text-black">
                        Updated {updateDate || '未更新'}
                    </span>
                </div>
            </div>

            <hr className="line-item" />

            {/* 引渡记录输入区域 */}
            <div className="mb-8 mt-6">
                <h2 className="text-xl font-semibold mb-5">引渡</h2>

                {/* --------------- 第 1 行：日期、枚数、引渡先 --------------- */}
                <div className="mb-4 flex items-center gap-4">
                    <div className='flex items-end space-x-1'>
                        <input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                            className="w-64 px-3 py-2 input-item"
                        /><span className='w-4'>に</span>
                    </div>
                    <div className='flex items-end space-x-1'>
                        <input
                            type="number"
                            value={deliveryCount}
                            onChange={(e) => {
                                const newValue = Number(e.target.value);
                                if (e.target.value === "" || (Number.isFinite(newValue) && newValue >= 0)) {
                                    setDeliveryCount(e.target.value);
                                }
                            }}
                            className="w-64 px-3 py-2 input-item"
                            placeholder="引渡枚数"
                        /><span className='w-4'>枚</span>
                    </div>
                    <div className='flex items-end space-x-1'>
                        <select
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="w-64 px-3 py-2 input-item"
                        >
                            <option value="">引渡先</option>
                            {companies.map(comp => (
                                <option key={comp} value={comp}>{comp}</option>
                            ))}
                        </select><span className='w-4'>へ</span>
                    </div>
                </div>

                {/* --------------- 第 2 行：受取人、担当者 --------------- */}
                <div className="mb-4 flex items-center gap-4">
                    <div className='flex items-end space-x-1'>
                        <input
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="w-64 px-3 py-2 input-item"
                            placeholder="受取人"
                        /><span className='w-4'>様</span>
                    </div>
                    <div className='flex items-end space-x-1'>
                        <select
                            value={person}
                            onChange={(e) => setPerson(e.target.value)}
                            className="w-64 px-3 py-2 input-item"
                        >
                            <option value="">担当者</option>
                            {personList.map(per => (
                                <option key={per} value={per}>{per}</option>
                            ))}
                        </select>
                        <span className='w-6'>さん</span>
                    </div>
                </div>

                {/* --------------- 第 3 行：保存ボタン --------------- */}
                <div className="mb-4">
                    <ConfirmModal
                        onConfirm={handleDeliverySave}
                        buttonText="保存"
                        message="保存しますか"
                        buttonColor="save-button"
                    />
                </div>
            </div>

            <hr className="line-item" />

            {/* 月度记录折叠列表 */}
            <div className="mb-8 mt-6">
                <h2 className="text-lg font-semibold mb-5">引渡履歴</h2>

                {sortedMonths.length > 0 ? (
                    <>
                        <div className="space-y-3">
                            {paginatedMonths.map((monthKey, i) => {
                                const monthRecords = recordsByMonth[monthKey];
                                const { stats, total } = getMonthStats(monthRecords);

                                return (
                                    <details
                                        key={i}
                                        className="table-details"
                                    >
                                        <summary className="table-details-content text-lg">
                                            <span className="font-semibold text-lg text-black">{monthKey}</span>
                                            <span className="text-sm text-sky-700"> 総 {monthRecords.length} 回 </span>
                                            <span className="text-sm font-medium text-sky-700">＆ {total} 枚</span>
                                        </summary>

                                        <div className="p-3 text-sm">
                                            {/* 公司统计行 */}
                                            <div className="bg-sky-200 p-3 rounded-md mb-3">
                                                <div className="flex flex-wrap gap-4 text-sm">
                                                    {companies.map(comp => {
                                                        const count = stats[comp];
                                                        if (count > 0) {
                                                            return (
                                                                <span key={comp} className="text-gray-700">
                                                                    <span className="font-medium">{comp}:</span> {count} 枚
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            </div>

                                            {/* 记录表格 */}
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-blue-600 text-left text-white">
                                                        <th className="border border-blue-300 px-2 py-1">日付</th>
                                                        <th className="border border-blue-300 px-2 py-1 w-24 text-center">引渡枚数</th>
                                                        <th className="border border-blue-300 px-2 py-1">引渡先</th>
                                                        <th className="border border-blue-300 px-2 py-1">受取人</th>
                                                        <th className="border border-blue-300 px-2 py-1">担当者</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {monthRecords.map((record) => (
                                                        <tr
                                                            key={record.id}
                                                            className="hover:bg-yellow-200 transition-colors"
                                                        >
                                                            <td className="border border-blue-100 px-2 py-1">
                                                                {formatDate(record.delivery_date)}
                                                            </td>
                                                            <td className="border border-blue-100 px-2 py-1 text-center">
                                                                {record.delivery_count}
                                                            </td>
                                                            <td className="border border-blue-100 px-2 py-1">
                                                                {record.company}
                                                            </td>
                                                            <td className="border border-blue-100 px-2 py-1">
                                                                {record.recipient || '-'}
                                                            </td>
                                                            <td className="border border-blue-100 px-2 py-1">
                                                                {record.person || '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                );
                            })}
                        </div>

                        {/* 月份分页 */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-6">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-black"
                                >
                                    上一页
                                </button>
                                <span className="text-sm text-gray-600">
                                    第 {currentPage} / {totalPages} 页
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-black"
                                >
                                    下一页
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-gray-800">履歴なし</p>
                )}
            </div>
            <AlertModal ref={alertRef} />
            <WarningModal ref={warningRef} />
            <LoadingModal show={loading} message={loadingMessage} />
        </div>
    );
};

export default InventoryManagement;