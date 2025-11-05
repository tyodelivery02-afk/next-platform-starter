"use client";

import { useEffect, useState, useRef } from "react";
import { X,Trash,Plus } from "phosphor-react";
import ConfirmModal from "components/confirm";
import AlertModal from "components/alert";
import LoadingModal from "components/loading";

export default function AreaEditor({ mode = "朝" }) {
  const [show, setShow] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const alertRef = useRef();

  // 获取数据
  useEffect(() => {
    fetch("/api/fcatmaker/area_search")
      .then((res) => res.json())
      .then((rows) => {
        const arr = rows.map((r) => ({
          region_name: r.region_name,
          keywords: Array.isArray(r.keywords)
            ? r.keywords
            : JSON.parse(r.keywords || "[]"),
        }));
        setData(arr);
      });
  }, []);

  // 增加地区
  const addRegion = () => {
    setData((prev) => [...prev, { region_name: "", keywords: [""] }]);
  };

  // 增加关键词列
  const addKeyword = (regionIdx) => {
    const newData = [...data];
    newData[regionIdx].keywords.push("");
    setData(newData);
  };

  // 修改关键词
  const updateValue = (regionIdx, keywordIdx, value) => {
    const newData = [...data];
    newData[regionIdx].keywords[keywordIdx] = value;
    setData(newData);
  };

  // 修改地区名
  const updateRegion = (regionIdx, value) => {
    const newData = [...data];
    newData[regionIdx].region_name = value;
    setData(newData);
  };

  // 删除地区
  const deleteRegion = (regionIdx) => {
    setData((prev) => prev.filter((_, idx) => idx !== regionIdx));
  };

  // 删除关键词
  const deleteKeyword = (regionIdx, keywordIdx) => {
    const newData = [...data];
    newData[regionIdx].keywords = newData[regionIdx].keywords.filter(
      (_, idx) => idx !== keywordIdx
    );
    setData(newData);
  };

  // 保存
  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fcatmaker/area_search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        alertRef.current?.open({ message: "保存失敗！" });
      }

      alertRef.current?.open({ message: "保存成功！" });
      // setShow(false);
    } catch (error) {
      alertRef.current?.open({ message: "保存失敗！" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-2">
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-2 hover:opacity-70 transition-opacity duration-200" >
        <span className={`font-bold w-25 ${mode === "朝" ? "text-gray-800" : "text-white"}`}>
          エリア設定：
        </span>
        <svg
          className="animate-spin w-10 h-10 mb-4"
          style={{ animationDuration: '3.5s' }}
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          fill={mode === "朝" ? "#000000" : "#ffffff"}
          viewBox="0 0 256 256"
        >
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,16a87.5,87.5,0,0,1,48,14.28V74L153.83,99.74,122.36,104l-.31-.22L102.38,90.92A16,16,0,0,0,79.87,95.1L58.93,126.4a16,16,0,0,0-2.7,8.81L56,171.44l-3.27,2.15A88,88,0,0,1,128,40ZM62.29,186.47l2.52-1.65A16,16,0,0,0,72,171.53l.21-36.23L93.17,104a3.62,3.62,0,0,0,.32.22l19.67,12.87a15.94,15.94,0,0,0,11.35,2.77L156,115.59a16,16,0,0,0,10-5.41l22.17-25.76A16,16,0,0,0,192,74V67.67A87.87,87.87,0,0,1,211.77,155l-16.14-14.76a16,16,0,0,0-16.93-3l-30.46,12.65a16.08,16.08,0,0,0-9.68,12.45l-2.39,16.19a16,16,0,0,0,11.77,17.81L169.4,202l2.36,2.37A87.88,87.88,0,0,1,62.29,186.47ZM185,195l-4.3-4.31a16,16,0,0,0-7.26-4.18L152,180.85l2.39-16.19L184.84,152,205,170.48A88.43,88.43,0,0,1,185,195Z"></path>
        </svg>
      </button>
      <hr className="line-item" />
      {show && (
        <div className="fixed inset-0 bg-gray-800/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900/30 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">エリア編集</h2>
              <button
                onClick={() => setShow(false)}
                className="text-white hover:bg-gray-700 rounded-lg p-2 transition-all duration-200"
              >
                <X size={24} weight="bold" />
              </button>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800/30 text-white">
                      <th className="border-b border-gray-600 p-4 text-left font-semibold w-1/5">
                        エリア
                      </th>
                      <th className="border-b border-gray-600 p-4 text-left font-semibold">
                        検索キーワード
                      </th>
                      <th className="border-b border-gray-600 p-4 text-center font-semibold w-24">
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((region, i) => (
                      <tr
                        key={i}
                        className="hover:bg-gray-800/70 transition-colors border-b border-gray-700/50 last:border-b-0"
                      >
                        <td className="p-4">
                          <input
                            className="bg-gray-700 border border-gray-600 rounded-lg w-full p-2.5 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            value={region.region_name}
                            onChange={(e) => updateRegion(i, e.target.value)}
                            placeholder="エリア"
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {region.keywords.map((kw, j) => (
                              <div key={j} className="flex items-center gap-1">
                                <input
                                  className="bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-w-[120px]"
                                  value={kw}
                                  onChange={(e) =>
                                    updateValue(i, j, e.target.value)
                                  }
                                  placeholder="検索キーワード"
                                />
                                <button
                                  onClick={() => deleteKeyword(i, j)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded p-1 transition-all"
                                  title="削除"
                                >
                                  <X size={16} weight="bold" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addKeyword(i)}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded p-1 transition-all"
                            >
                              <Plus size={16} weight="bold" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => deleteRegion(i)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg px-3 py-2 font-medium transition-all"
                          >
                            <Trash size={24} weight="bold" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/30">
              <button
                onClick={addRegion}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                + エリア追加
              </button>
              <div className="flex gap-3">
                <ConfirmModal
                  onConfirm={handleSave}
                  buttonText="保存"
                  message="保存しますか"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <AlertModal ref={alertRef} />
      <LoadingModal show={loading} message="Saving..." />
    </div>
  );
}