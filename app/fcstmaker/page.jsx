"use client";
import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { MoonStars, Sun } from "phosphor-react";
import ConfirmModal from "components/confirm";
import { validSources } from 'app/config/config';
import WarningModal from "components/warning";
import AreaEditor from "components/areaSearch";
import LoadingModal from "components/loading";
import Link from 'next/link';

export default function FCSTMakerPage() {
  const [rows, setRows] = useState([]); // 朝/夜筛选后的结果
  const [rawData, setRawData] = useState([]); // 朝/夜原始数据
  const [mode, setMode] = useState("朝"); // 朝/夜模式
  const [isOpen, setIsOpen] = useState(true); // 朝/夜表格折叠状态

  const [statsRows, setStatsRows] = useState([]); // 地区统计表格数据
  const [statsRawData, setStatsRawData] = useState([]); // 地区统计原始数据
  const [isStatsOpen, setIsStatsOpen] = useState(true); // 统计表折叠状态
  const [regionOrder, setRegionOrder] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
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
        else if (dateM.isSame(today, "day") && N && N <= "15:00:00") result.push({ G, M, N });
      } else if (selectedMode === "夜") {
        if (dateM.isBefore(today, "day") || dateM.isSame(today, "day")) result.push({ G, M, N });
        else if (dateM.isSame(tomorrow, "day") && N && N <= "15:00:00") result.push({ G, M, N });
      }
    });

    setRows(result);
  };

  const handleModeChange = (e) => {
    const newMode = e.target.value;
    setMode(newMode);
    filterData(rawData, newMode);
  };

  //0~14:朝;14~23:夜
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 14) {
      setMode("朝");
    } else {
      setMode("夜");
    }
  }, []);

  // ------------------- 地区统计 -------------------
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

  const handleStatsFile = (e) => {

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setLoading(true);
      try {
        const arrayBuffer = event.target.result;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        setStatsRawData(data);

        const res = await fetch("/api/fcatmaker/area_search");
        if (!res.ok) {
          console.error("地区データの取得に失敗しました:", res.status);
          return;
        }

        const areas = await res.json();
        const mapping = {};
        let order = [];

        areas.forEach((a) => {
          mapping[a.region_name] = Array.isArray(a.keywords)
            ? a.keywords
            : JSON.parse(a.keywords || "[]");
          order.push(a.region_name);
        });

        const osaka = order.find(r => r === "関西");
        const tokyo = order.find(r => r === "関東");
        const others = order.filter(r => r !== "関西" && r !== "関東");

        const sortedOrder = [
          ...(osaka ? [osaka] : []),
          ...(tokyo ? [tokyo] : []),
          ...others
        ];

        setRegionOrder(sortedOrder);
        processStats(data, mapping, sortedOrder);
      } catch (err) {
        console.error("handleStatsFile error:", err);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processStats = (data, mapping, regionOrder) => {
    if (!Array.isArray(data) || !mapping || typeof mapping !== "object") return;

    const groupMap = {};
    const totals = {};

    data.forEach((row, idx) => {
      if (idx === 0) return;
      if (!row || !Array.isArray(row)) return;

      const E = row[4];
      const D = row[3];
      const M = row[12];
      if (!E || !M) return;
      if (!String(D).startsWith("E")) return;

      if (!groupMap[E]) {
        groupMap[E] = {};
        regionOrder.forEach((key) => (groupMap[E][key] = 0));
      }

      Object.entries(mapping).forEach(([key, keywords]) => {
        if (keywords.some((kw) => String(M).startsWith(kw))) {
          groupMap[E][key] += 1;
        }
      });
    });

    const newRows = [];
    Object.entries(groupMap).forEach(([E, counts]) => {
      const line = [E];
      regionOrder.forEach((key) => {
        line.push(counts[key]);
        totals[key] = (totals[key] || 0) + counts[key];
      });
      newRows.push(line);
    });

    const total1 = ["総計1"];
    const sumOsakaTokyo = (totals["関西"] || 0) + (totals["関東"] || 0);
    regionOrder.forEach((key) => {
      if (key === "関西" || key === "関東") {
        total1.push(
          sumOsakaTokyo
            ? `${((totals[key] / sumOsakaTokyo) * 100).toFixed(1)}%`
            : "0%"
        );
      } else {
        total1.push(totals[key] || 0);
      }
    });

    const total2 = ["総計2"];
    regionOrder.forEach((key) => total2.push(totals[key] || 0));

    setStatsRows([...newRows, total1, total2]);
  };

  // 辅助函数：将文件转换为 base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!file) {
      warningRef.current?.open({ message: "Excelを選んでください" });
      return;
    }
    if (!statsRows || statsRows.length === 0) {
      warningRef.current?.open({ message: "集計データなし" });
      return;
    }

    setLoading(true);
    const excelname = file.name;

    try {
      // 组装 FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("statsData", JSON.stringify([["マスタ番号", ...regionOrder], ...statsRows]));

      console.log("✓ 准备调用后端 Python 处理脚本...");

      const res = await fetch("/api/fcatmaker", {
        method: "POST",
        body: formData,
      });

      console.log("✓ 响应状态:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = excelname;
      a.click();
      URL.revokeObjectURL(url);

      console.log("✓ 下载完成！");
    } catch (err) {
      console.error("处理失败:", err);
      alert("处理 Excel 文件失败:\n" + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-8 min-h-screen text-black ${mode === "朝"
      ? "bg-gradient-to-b from-sky-200 via-sky-100 to-white"
      : "bg-gradient-to-b from-sky-400 to-sky-800"
      }`}
    >
      <h2 className="relative text-x2 font-bold text-black text-shadow">スーパーフォーキャストメーカー</h2>
      <div
        className="w-full h-6 my-6"
        style={{
          backgroundImage: "url(/images/divider.svg)",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 35%",
        }}
      ></div>

      <div className="flex items-center justify-start gap-17">
        {/* エリア編集控件 */}

        <div className="flex items-center gap-2">
          <span className={`font-bold ${mode === "朝" ? "text-black" : "text-white"}`}>
            エリア設定：
          </span>
          <AreaEditor mode={mode} />
        </div>

        <div className="flex items-center gap-2">
          {/* 左侧文字 */}
          <span
            className={`font-bold ${mode === "朝" ? "text-black" : "text-white"
              }`}
          >
            その他ツール：
          </span>

          {/* 右侧可点击图标 */}
          <Link
            href="https://mega.nz/folder/CQFTVK7J#NfZWDyg27yGLhJB4rAUdzg"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70 transition-transform duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              className="w-10 h-10 mb-4"
              fill={mode === "朝" ? "#000000" : "#ffffff"}
              viewBox="0 0 256 256"
            >
              <path d="M224,64H176V56a24,24,0,0,0-24-24H104A24,24,0,0,0,80,56v8H32A16,16,0,0,0,16,80V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V80A16,16,0,0,0,224,64ZM96,56a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM224,80v32H192v-8a8,8,0,0,0-16,0v8H80v-8a8,8,0,0,0-16,0v8H32V80Zm0,112H32V128H64v8a8,8,0,0,0,16,0v-8h96v8a8,8,0,0,0,16,0v-8h32v64Z"></path>
            </svg>
          </Link>
        </div>

      </div>

      <hr className="line-item" />

      {/* 朝/夜上传控件 */}
      <div className="flex items-center space-x-2 mt-6 mb-2">
        <span className={`${mode === "朝" ? "text-gray-800" : "text-white"} font-bold w-25`}>マスタ抽出：</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile}
          className={mode === "朝" ? "inputfile-item" : "inputfile-item-light"} />
      </div>

      {/* 朝/夜单选 */}
      <div className="flex items-center space-x-6 text-white mb-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="radio" name="mode" value="朝" checked={mode === "朝"} onChange={handleModeChange} className="accent-yellow-400" />
          <Sun size={32} className={`${mode === "朝" ? "text-yellow-400" : "text-gray-500"}`} />
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="radio" name="mode" value="夜" checked={mode === "夜"} onChange={handleModeChange} className="accent-black" />
          <MoonStars size={32} className={`${mode === "夜" ? "text-white" : "text-gray-400"}`} />
        </label>
      </div>

      {/* 朝/夜折叠表格 */}
      {rows.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setIsOpen(!isOpen)}
            className={`orther-button mb-2 px-3 py-1 ${mode === "朝" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-sky-700 hover:bg-sky-800"}`}>
            {isOpen ? "閉じる ▲" : "開く ▼"}
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[2000px]" : "max-h-0"}`}>
            <div className="flex space-x-4 mt-2">
              <table className="border border-gray-300 border-collapse text-sm w-1/3">
                <thead className="bg-white"><tr><th className="border border-gray-300 text-black p-2">マスタ番号</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="text-center transition-all cursor-pointer hover:bg-yellow-400">
                      <td className="border border-gray-300 p-2">{r.G}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="border border-gray-300 border-collapse text-sm w-2/3">
                <thead className="bg-white"><tr><th className="border border-gray-300 text-black p-2">到着予定日</th><th className="border border-gray-300 text-black p-2">到着予定時間</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="text-center transition-all cursor-pointer hover:bg-yellow-400">
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
      <hr className="line-item" />

      {/* 地区统计读取文件 */}
      <div className="flex items-center space-x-2 mt-6 mb-2">
        <span className={`${mode === "朝" ? "text-gray-800" : "text-white"} font-bold w-25`}>集計：</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleStatsFile}
          className={mode === "朝" ? "inputfile-item" : "inputfile-item-light"} />
      </div>

      {/* 地区统计折叠表格 */}
      {statsRows.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setIsStatsOpen(!isStatsOpen)}
            className={`orther-button mb-2 px-3 py-1 ${mode === "朝" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-700 hover:bg-gray-800"}`}>
            {isStatsOpen ? "閉じる ▲" : "開く ▼"}
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${isStatsOpen ? "max-h-[2000px]" : "max-h-0"}`}>
            <div className="overflow-x-auto">
              <table className="border border-gray-300 border-collapse text-sm w-full table-fixed">
                <thead className="bg-white">
                  <tr>
                    <th className="border border-gray-300 text-black p-2">マスタ番号</th>
                    {regionOrder.map((region, idx) => (
                      <th key={idx} className="border border-gray-300 text-black p-2">
                        {region}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statsRows.map((row, i) => (
                    <tr
                      key={i}
                      className="text-center transition-all cursor-pointer hover:bg-yellow-400"
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
                              className="block w-full text-center border rounded px-1 bg-yellow-100 outline-none transition-all focus:bg-pink-200"
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
      <hr className="line-item" />

      {/* エクスポート */}
      <div className="flex items-center space-x-2 mt-6 mb-2">
        <span className={`${mode === "朝" ? "text-black" : "text-white"} font-bold w-25`}>FCST作成：</span>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files[0])}
          className={mode === "朝" ? "inputfile-item" : "inputfile-item-light"}
        />
        <div className="flex gap-2">
          <ConfirmModal
            onConfirm={handleUpload}
            buttonText="作成"
            message="FCST作成しますか"
            buttonColor={`orther-button ${mode === "朝" ? "bg-yellow-500 hover:bg-yellow-400" : "bg-sky-500 hover:bg-sky-400"}`}
          />
        </div>
      </div>
      <WarningModal ref={warningRef} />
      <LoadingModal show={loading} message="Executing..." />
    </div>
  );
}