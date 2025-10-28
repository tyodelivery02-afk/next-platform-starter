"use client";
import Image from 'next/image';
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { MoonStars, Sun } from "phosphor-react";
import ConfirmModal from "components/confirm";
import { validSources, mapping } from 'app/config/config';
import WarningModal from "components/warning";

export default function ExcelFilterPage() {
  const [rows, setRows] = useState([]); // 朝/夜筛选后的结果
  const [rawData, setRawData] = useState([]); // 朝/夜原始数据
  const [mode, setMode] = useState("朝"); // 朝/夜模式
  const [isOpen, setIsOpen] = useState(true); // 朝/夜表格折叠状态

  const [statsRows, setStatsRows] = useState([]); // 地区统计表格数据
  const [statsRawData, setStatsRawData] = useState([]); // 地区统计原始数据
  const [isStatsOpen, setIsStatsOpen] = useState(true); // 统计表折叠状态
  const warningRef = useRef();

  // ------------------- 朝/夜表格 -------------------
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      setRawData(data);
      filterData(data, mode);
    };
    reader.readAsArrayBuffer(file);
  };

  const filterData = (data, selectedMode) => {
    const today = dayjs();
    const tomorrow = today.add(1, "day");
    const result = [];

    data.forEach((row, idx) => {
      if (idx === 0) return;
      const G = row[6];
      const H = row[7];
      const M = row[12];
      let N = row[13];

      if (!H || !M) return;
      if (!validSources.includes(String(H).trim())) return;

      const [mm, dd] = String(M).split("/").map((v) => v.padStart(2, "0"));
      const dateM = dayjs(`${today.year()}-${mm}-${dd}`);
      if (!dateM.isValid()) return;

      if (typeof N === "number") N = XLSX.SSF.format("hh:mm:ss", N);
      else if (typeof N === "string") {
        if (N.includes(":")) {
          const parsed = dayjs(N, ["HH:mm:ss", "HH:mm"]);
          if (parsed.isValid()) N = parsed.format("HH:mm:ss");
        } else {
          const num = parseFloat(N);
          if (!isNaN(num)) N = XLSX.SSF.format("hh:mm:ss", num);
        }
      }

      if (selectedMode === "朝") {
        if (dateM.isBefore(today, "day")) result.push({ G, M, N });
        else if (dateM.isSame(today, "day") && N && N <= "16:00:00") result.push({ G, M, N });
      } else if (selectedMode === "夜") {
        if (dateM.isBefore(today, "day") || dateM.isSame(today, "day")) result.push({ G, M, N });
        else if (dateM.isSame(tomorrow, "day") && N && N <= "16:00:00") result.push({ G, M, N });
      }
    });

    setRows(result);
  };

  const handleModeChange = (e) => {
    const newMode = e.target.value;
    setMode(newMode);
    filterData(rawData, newMode);
  };

  // ------------------- 地区统计 -------------------
  const handleStatsFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      setStatsRawData(data);
      processStats(data);
    };

    reader.readAsArrayBuffer(file);
  };

  const processStats = (data) => {
    if (!Array.isArray(data)) return;

    const groupMap = {};
    const totals = {};

    data.forEach((row, idx) => {
      if (idx === 0) return;
      if (!row || !Array.isArray(row)) return;

      const E = row[4]; // E列
      const D = row[3]; // D列
      const L = row[11]; // L列
      if (!E || !L) return;
      if (!String(D).startsWith("E")) return;

      if (!groupMap[E]) {
        groupMap[E] = {};
        Object.keys(mapping).forEach((key) => (groupMap[E][key] = 0));
      }

      Object.entries(mapping).forEach(([key, keywords]) => {
        if (keywords.some((kw) => String(L).startsWith(kw))) {
          groupMap[E][key] += 1;
        }
      });
    });

    Object.entries(groupMap).forEach(([E, counts]) => {
      const line = [E];
      Object.keys(mapping).forEach((key) => {
        line.push(counts[key]);
        totals[key] = (totals[key] || 0) + counts[key];
      });
      setStatsRows((prev) => [...prev, line]);
    });

    // 总计行
    const total1 = ["総計1"];
    const sumOsakaTokyo = (totals["大阪"] || 0) + (totals["東京"] || 0);
    Object.keys(mapping).forEach((key) => {
      if (key === "大阪") total1.push(sumOsakaTokyo ? `${((totals[key] / sumOsakaTokyo) * 100).toFixed(1)}%` : "0%");
      else if (key === "東京") total1.push(sumOsakaTokyo ? `${((totals[key] / sumOsakaTokyo) * 100).toFixed(1)}%` : "0%");
      else total1.push(totals[key] || 0);
    });

    const total2 = ["総計2"];
    Object.keys(mapping).forEach((key) => total2.push(totals[key] || 0));

    setStatsRows((prev) => [...prev, total1, total2]);
  };

  //单元格编辑
  const [editingCell, setEditingCell] = useState(null); // 当前正在编辑的单元格 {row, col}
  const [editValue, setEditValue] = useState("");       // 编辑中的值

  const handleEdit = (rowIndex, colIndex, cellValue) => {
    setEditingCell({ row: rowIndex, col: colIndex });
    setEditValue(cellValue);
  };

  const saveEdit = (rowIndex, colIndex) => {
    const updated = [...statsRows];
    updated[rowIndex][colIndex] = editValue;
    setStatsRows(updated);
    setEditingCell(null);
  };

  //エクスポート
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) {
      warningRef.current?.open({ message: "Excelを選んでください" });
      return;
    }
    if (!statsRows || statsRows.length === 0) {
      warningRef.current?.open({ message: "集計データなし" });
      return;
    }

    const formData = new FormData();
    const excelname = file.name
    formData.append("file", file);
    // 上传时手动加上表头行
    const tableHeader = ["マスタ番号", "大阪", "東京", "滋賀", "兵庫1"];
    formData.append("statsData", JSON.stringify([tableHeader, ...statsRows]));


    try {
      const res = await fetch("/api/fcatmaker", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("后端返回错误:", errorText);
        throw new Error(errorText || "处理 Excel 文件失败");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = excelname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel 上传/处理失败:", err);
      alert("处理 Excel 文件失败:\n" + err.message);
    }
  };

  return (
    <div className={`p-5 font-['Microsoft_YaHei'] min-h-screen ${mode === "朝"
      ? "bg-gradient-to-b from-gray-400 to-yellow-900"
      : "bg-gradient-to-b from-gray-400 to-gray-900"
      }`}
    >
      <h2 className="text-x2 font-bold text-black">スパーフォーキャストメーカー</h2>
      <div
        className="w-full h-6 my-6"
        style={{
          backgroundImage: "url(/images/divider.svg)",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 35%",
        }}
      ></div>

      {/* <div className="relative my-6">
        <div className="h-[2px] bg-purple-500/40 blur-sm"></div>
        <div className="absolute inset-0 h-[1px] bg-black"></div>
      </div> */}

      {/* 朝/夜上传控件 */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-white font-bold w-25">マスタ抽出：</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile}
          className="border border-gray-300 px-3 py-1.5 rounded-md text-sm cursor-pointer hover:border-black transition" />
      </div>

      {/* 朝/夜单选 */}
      <div className="flex items-center space-x-6 text-white mb-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="radio" name="mode" value="朝" checked={mode === "朝"} onChange={handleModeChange} className="accent-yellow-400" />
          <Sun size={32} className={`${mode === "朝" ? "text-yellow-400" : "text-gray-300"}`} />
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="radio" name="mode" value="夜" checked={mode === "夜"} onChange={handleModeChange} className="accent-black" />
          <MoonStars size={32} className={`${mode === "夜" ? "text-black" : "text-gray-300"}`} />
        </label>
      </div>

      {/* 朝/夜折叠表格 */}
      {rows.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setIsOpen(!isOpen)}
            className={`mb-2 px-3 py-1 text-white rounded-md transition ${mode === "朝" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-700 hover:bg-gray-800"}`}>
            {isOpen ? "閉じる ▲" : "開く ▼"}
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[2000px]" : "max-h-0"}`}>
            <div className="flex space-x-4 mt-2">
              <table className="border border-gray-300 border-collapse text-sm w-1/3">
                <thead className="bg-white"><tr><th className="border border-gray-300 text-black p-2">マスタ番号</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`text-center transition-colors cursor-pointer ${mode === "朝" ? "hover:bg-yellow-600" : "hover:bg-black"}`}>
                      <td className="border border-gray-300 p-2">{r.G}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="border border-gray-300 border-collapse text-sm w-2/3">
                <thead className="bg-white"><tr><th className="border border-gray-300 text-black p-2">到着予定日</th><th className="border border-gray-300 text-black p-2">到着予定時間</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`text-center transition-colors cursor-pointer ${mode === "朝" ? "hover:bg-yellow-600" : "hover:bg-black"}`}>
                      <td className="border border-gray-300 p-2">{r.M}</td>
                      <td className="border border-gray-300 p-2">{r.N}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <hr className="h-1 bg-gradient-to-r from-transparent via-gray-400 to-transparent my-4" />

      {/* 地区统计读取文件 */}
      <div className="flex items-center space-x-2 mt-6 mb-2">
        <span className="text-white font-bold w-25">集計：</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleStatsFile}
          className="border border-gray-300 px-3 py-1.5 rounded-md text-sm cursor-pointer hover:border-black transition" />
      </div>

      {/* 地区统计折叠表格 */}
      {statsRows.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setIsStatsOpen(!isStatsOpen)}
            className={`mb-2 px-3 py-1 text-white rounded-md transition ${mode === "朝" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-700 hover:bg-gray-800"}`}>
            {isStatsOpen ? "閉じる ▲" : "開く ▼"}
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${isStatsOpen ? "max-h-[2000px]" : "max-h-0"}`}>
            <div className="overflow-x-auto">
              <table className="border border-gray-300 border-collapse text-sm w-full table-fixed">
                <thead className="bg-white">
                  <tr>{["マスタ番号", "大阪", "東京", "滋賀", "兵庫1"].map((col, idx) => <th key={idx} className="border border-gray-300 text-black p-2">{col}</th>)}</tr>
                </thead>
                <tbody>
                  {statsRows.map((row, i) => (
                    <tr
                      key={i}
                      className={`text-center transition-colors cursor-pointer ${mode === "朝" ? "hover:bg-yellow-600" : "hover:bg-black"
                        }`}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="border border-gray-300 p-2"
                          onDoubleClick={() => handleEdit(i, j, cell)}
                        >
                          {editingCell?.row === i && editingCell?.col === j ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => saveEdit(i, j)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(i, j);
                              }}
                              className={`block w-full text-center border rounded px-1 bg-yellow-100 outline-none transition-colors 
                                ${mode === "朝" ? "focus:bg-red-500" : "focus:bg-blue-900"}`}
                              autoFocus
                            />
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <hr className="h-1 bg-gradient-to-r from-transparent via-gray-400 to-transparent my-4" />

      {/* エクスポート */}
      <div className="flex items-center space-x-2 mt-6 mb-2">
        <span className="text-white font-bold w-25">FCST作成：</span>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files[0])}
          className="border border-gray-300 px-3 py-1.5 rounded-md text-sm cursor-pointer hover:border-black transition"
        />
        <div className="flex gap-2">
          <ConfirmModal
            onConfirm={handleUpload}
            buttonText="FCST作成"
            message="FCST作成しますか"
            buttonColor={`${mode === "朝" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-700 hover:bg-gray-800"}`}
          />
        </div>
      </div>
      <WarningModal ref={warningRef} />
    </div>
  );
}