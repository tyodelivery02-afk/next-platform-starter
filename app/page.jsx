"use client";

import { useState, useEffect, useRef } from "react";
import LoadingModal from "components/loading";
import { X, FloppyDisk, Plus } from "phosphor-react";
import AlertModal from "components/alert";

export default function Home() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const alertRef = useRef();

  // 初始化加载公告
  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/announcements");
        if (res.ok) {
          const data = await res.json();
          console.log("获取到公告数据:", data);
          setAnnouncements(data);
        } else {
          console.error("公告加载失败");
        }
      } catch (err) {
        console.error("请求失败:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  // 添加公告
  const addAnnouncement = () => {
    setAnnouncements([{ content: "", created_ip: "", updated_ip: "" }, ...announcements]);
  };

  // 修改内容
  const handleChange = (index, value) => {
    const updated = [...announcements];
    updated[index].content = value;
    setAnnouncements(updated);
  };

  // 保存单条公告
  const handleSaveOne = async (index) => {
    const item = announcements[index];
    const tempId = `temp_${index}`;
    setSavingId(item.id || tempId);

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id || null,
          content: item.content
        }),
      });

      if (res.ok) {
        const result = await res.json();
        alertRef.current?.open({ message: "保存成功！" });

        // 更新本地数据，保持 id
        if (result.id && !item.id) {
          const updated = [...announcements];
          updated[index].id = result.id;
          setAnnouncements(updated);
        }

        // 重新加载以获取最新数据
        const refreshRes = await fetch("/api/announcements");
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setAnnouncements(data);
        }
      } else {
        alertRef.current?.open({ message: "保存失敗！" });
      }
    } catch (err) {
      console.error(err);
      alertRef.current?.open({ message: "保存失敗！" });
    } finally {
      setSavingId(null);
    }
  };

  // 删除单条公告（逻辑删除）
  const handleDeleteOne = async (index) => {
    const item = announcements[index];

    // 如果是新添加的还没保存的公告，直接从数组中移除
    if (!item.id) {
      const updated = announcements.filter((_, i) => i !== index);
      setAnnouncements(updated);
      return;
    }

    setDeletingId(item.id);

    try {
      const res = await fetch("/api/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });

      if (res.ok) {
        alertRef.current?.open({ message: "削除成功！" });
        // 从列表中移除
        const updated = announcements.filter((_, i) => i !== index);
        setAnnouncements(updated);
      } else {
        alertRef.current?.open({ message: "削除失敗！" });
      }
    } catch (err) {
      console.error(err);
      alertRef.current?.open({ message: "削除失敗！" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="bg-style">
      {/* 标题 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="relative text-x2 font-bold text-black text-shadow">掲示板</h2>
      </div>
      <div
        className="w-full h-6 my-6"
        style={{
          backgroundImage: "url(/images/divider.svg)",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 35%",
        }}
      ></div>
      <div
        className="backdrop-blur-md bg-white/10 border border-sky-300 shadow-md 
               rounded-xl p-8 w-full max-w-7xl transition-all duration-500 
               hover:shadow-yellow-200 hover:scale-101"
      >

        {/* 添加按钮 */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={addAnnouncement}
            className="text-yellow-600 hover:text-yellow-800 rounded p-1 transition-all"
            title="追加"
          >
            <Plus size={24} weight="bold" />
          </button>
        </div>

        {/* 公告列表 */}
        <div className="space-y-5">
          {announcements.map((item, index) => {
            const isSaving = savingId === (item.id || `temp_${index}`);
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id || `temp_${index}`}
                className="p-4 rounded-lg bg-white/20 border border-sky-200
                           shadow-md hover:bg-white/30 transition-all duration-300 
                           hover:hover:scale-101 hover:shadow-yellow-200"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex-1">
                    <textarea
                      value={item.content}
                      onChange={(e) => handleChange(index, e.target.value)}
                      placeholder={`通知 ${index + 1}`}
                      className="w-full min-h-[100px] p-3 rounded-md bg-transparent text-black bg-yellow-200/60
                                 placeholder-gray-400 border border-sky-200 focus:outline-none focus:ring-2 
                                 focus:ring-yellow-400 font-medium resize-none transition-all duration-300 
                                 hover:hover:scale-101"
                    />
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveOne(index)}
                      disabled={isSaving || !item.content.trim()}
                      className="text-sky-600 hover:text-sky-800 rounded p-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="保存"
                    >
                      <FloppyDisk size={20} weight="bold" />
                    </button>

                    <button
                      onClick={() => handleDeleteOne(index)}
                      disabled={isDeleting}
                      className="text-yellow-600 hover:text-yellow-800 rounded p-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="削除"
                    >
                      <X size={20} weight="bold" />
                    </button>
                  </div>
                </div>

                {/* 元数据 */}
                <div className="mt-2 text-xs text-black flex justify-end">
                  <span>
                    {item.updated_at ? new Date(item.updated_at).toLocaleString() + " に " + item.updated_ip + " より掲載" : "未更新"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <AlertModal ref={alertRef} />
      <LoadingModal show={loading} message={loadingMessage} />
    </main>
  );
}