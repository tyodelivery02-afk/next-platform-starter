"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { hidePaths } from "app/config/config";
import { X, ChatCircle, PaperPlaneRight, Minus } from "phosphor-react";
import { normalizeCharacterState } from "../lib/character-state.mjs";
import styles from "./ad.module.css";

const EFFECTS = { neutral: "", happy: "✦", shy: "♡", thinking: "…", surprised: "!", concerned: "· · ·" };
const LABELS = { neutral: "", happy: "にこにこ", shy: "てれてれ", thinking: "考え中", surprised: "びっくり", concerned: "そっと寄り添う" };

export function FloatingCharacter() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
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
        <button type="button" className={styles.launcher} aria-label="キャラクターを開く" onClick={() => { setCollapsed(false); react({ expression: "happy", motion: "bounce" }); }}>
          <Image src="/images/misaki_meiku.png" alt="" width={40} height={48} style={{ objectFit: "contain", height: "auto" }} />
          <span className={styles.online} />
        </button>
      ) : (
        <>
          {chatOpen && <section className={styles.chat} aria-label="キャラクターとの会話">
            <header className={styles.chatHeader}><span><span className={styles.dot} />和子</span><button type="button" aria-label="チャットを閉じる" onClick={() => setChatOpen(false)}><Minus size={20} /></button></header>
            <div ref={logRef} className={styles.log} role="log" aria-live="polite" aria-relevant="additions text">
              {messages.map((msg, i) => <div key={i} className={`${styles.messageRow} ${msg.role === "user" ? styles.user : ""}`}><div className={styles.message}>{msg.text}</div></div>)}
              {loading && <div className={styles.typing} role="status" aria-label="考え中"><i /><i /><i /></div>}
            </div>
            <form className={styles.composer} onSubmit={e => { e.preventDefault(); handleSend(); }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); handleSend(); }
              }} aria-label="メッセージ" placeholder="話しかけてみて…" rows={2} />
              <button type="submit" disabled={loading || !input.trim()} aria-label="送信"><PaperPlaneRight size={20} /></button>
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
                    {EFFECTS[state.expression] && <span className={`${styles.effect} ${styles[state.expression]}`} aria-hidden="true">{EFFECTS[state.expression]}</span>}
                  </span>
                </span>
              </button>
              {state.expression !== "neutral" && <span className={styles.mood} aria-live="polite">{LABELS[state.expression]}</span>}
            </div>
            <div className={styles.characterControls}>
              <button type="button" aria-label={chatOpen ? "会話を閉じる" : "会話を開く"} onClick={() => setChatOpen(open => !open)}><ChatCircle size={17} /></button>
              <button type="button" aria-label="キャラクターを折りたたむ" onClick={() => { setCollapsed(true); setChatOpen(false); }}><X size={15} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
