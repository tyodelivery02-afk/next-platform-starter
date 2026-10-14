"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { hidePaths } from "app/config/config";
import { X, ChatCircle, Minus } from "phosphor-react";
import { normalizeCharacterState } from "../lib/character-state.mjs";
import styles from "./ad.module.css";

const EFFECTS = { neutral: "", happy: "✦", shy: "♡", thinking: "…", surprised: "!", concerned: "· · ·" };
const EFFECT_STYLES = {
  happy: "text-yellow-400",
  shy: "text-pink-400",
  thinking: "text-purple-500 bg-pink-100 rounded-full border border-pink-200",
  surprised: "text-orange-400",
  concerned: "text-sky-500 bg-pink-100 rounded-full border border-pink-200",
};
const LABELS = { neutral: "", happy: "にこにこ", shy: "てれてれ", thinking: "考え中", surprised: "びっくり", concerned: "そっと寄り添う" };

export function FloatingCharacter() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reaction, setReaction] = useState({ expression: "neutral", motion: "idle" });
  const [reactionKey, setReactionKey] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [messages, setMessages] = useState([{ role: "model", text: "やっほー、なにしとるん？" }]);
  const logRef = useRef(null);
  const requestRef = useRef(null);
  const inFlight = useRef(false);
  const reactionTimer = useRef(null);
  const speechTimer = useRef(null);
  const shouldHide = hidePaths.includes(pathname);
  const state = loading ? { expression: "thinking", motion: "tilt" } : reaction;

  const clearReactionTimers = () => {
    clearTimeout(reactionTimer.current);
    clearTimeout(speechTimer.current);
  };
  const react = (value, duration = 6500) => {
    clearReactionTimers();
    setReaction(normalizeCharacterState(value));
    setReactionKey(key => key + 1);
    setSpeaking(false);
    reactionTimer.current = setTimeout(() => setReaction({ expression: "neutral", motion: "idle" }), duration);
  };

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, loading, chatOpen]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
    clearTimeout(reactionTimer.current);
    clearTimeout(speechTimer.current);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    clearReactionTimers();
    setSpeaking(false);
    const history = messages;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }), signal: controller.signal,
      });
      const data = await res.json();
      if (requestRef.current !== controller) return;
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, { role: "model", text: data.reply || "うまくお返事できませんでした。" }]);
      react(data);
      setSpeaking(true);
      speechTimer.current = setTimeout(() => setSpeaking(false), Math.min(5000, Math.max(1600, (data.reply?.length || 0) * 45)));
    } catch (error) {
      if (requestRef.current !== controller) return;
      setMessages(prev => [...prev, { role: "model", text: error.name === "AbortError" ? "少し時間がかかっているみたい。もう一度話しかけてね。" : error.message || "今はお返事できません。もう一度試してね。" }]);
      react({ expression: "concerned", motion: "tilt" });
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        inFlight.current = false;
        setLoading(false);
      }
    }
  };

  if (shouldHide) return null;
  return (
    <div className={styles.widget}>
      {collapsed ? (
        <button type="button" className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center hover:scale-105 transition active:scale-95" aria-label="キャラクターを開く" onClick={() => { setCollapsed(false); react({ expression: "happy", motion: "bounce" }); }}>
          <Image src="/images/misaki_meiku.png" alt="" width={40} height={48} style={{ objectFit: "contain", height: "auto" }} />
        </button>
      ) : (
        <>
          {chatOpen && <section className={`table-div ${styles.chat}`} aria-label="キャラクターとの会話">
            <header className="table-title flex items-center justify-end px-2 py-1 text-sm shrink-0"><button type="button" className="minus-button" aria-label="チャットを閉じる" onClick={() => setChatOpen(false)}><Minus size={12} /></button></header>
            <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3" role="log" aria-live="polite" aria-relevant="additions text">
              {messages.map((msg, i) => <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words text-black ${msg.role === "user" ? "bg-orange-100" : "bg-pink-100"}`}>{msg.text}</div></div>)}
              {loading && <div className="px-3 py-2 rounded-2xl text-sm bg-pink-100 text-gray-500" role="status" aria-label="考え中">考え中…</div>}
            </div>
            <form className="border-t border-gray-200 p-2 flex items-end gap-2 bg-white shrink-0" onSubmit={e => { e.preventDefault(); handleSend(); }}>
              <textarea className="flex-1 min-w-0 resize-none input-item px-3 py-2 text-sm outline-none focus:border-pink-400" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); handleSend(); }
              }} aria-label="メッセージ" placeholder="話しかけてみて…" rows={2} />
              <button type="submit" disabled={loading || !input.trim()} className="send-button text-sm font-medium">送信</button>
            </form>
          </section>}
          <div className={styles.characterDock}>
            <div className={styles.characterSpace}>
              <button type="button" className={styles.characterButton} aria-label={chatOpen ? "チャットを閉じる" : "和子と話す"} aria-expanded={chatOpen} onClick={() => { setChatOpen(open => !open); if (!loading) react({ expression: "happy", motion: "nod" }); }}>
                <span className={styles.breath}>
                  <span key={`${reactionKey}:${loading}`} className={`${styles.figure} ${styles[state.motion]}`} data-expression={state.expression}>
                    <span className={speaking ? styles.speaking : styles.portrait}>
                      <Image src="/images/misaki.png" alt="和子" width={150} height={183} className={styles.image} />
                      {state.expression === "shy" && <><span className={`${styles.blush} ${styles.leftCheek}`} /><span className={`${styles.blush} ${styles.rightCheek}`} /></>}
                    </span>
                    {EFFECTS[state.expression] && <span className={`${styles.effect} ${styles[state.expression]} ${EFFECT_STYLES[state.expression]}`} aria-hidden="true">{EFFECTS[state.expression]}</span>}
                  </span>
                </span>
              </button>
              {state.expression !== "neutral" && <span className={`${styles.mood} bg-pink-100 text-pink-700 border border-pink-200 rounded-md px-2 py-1`} aria-live="polite">{LABELS[state.expression]}</span>}
            </div>
            <div className={styles.characterControls}>
              <button type="button" className="orther-button" style={{ padding: "4px 6px" }} aria-label={chatOpen ? "会話を閉じる" : "会話を開く"} onClick={() => setChatOpen(open => !open)}><ChatCircle size={12} /></button>
              <button type="button" className="orther-button" style={{ padding: "4px 6px" }} aria-label="キャラクターを折りたたむ" onClick={() => { setCollapsed(true); setChatOpen(false); }}><X size={10} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
