"use client";

import { useEffect, useRef, useState } from "react";
import { PiPentagram as PentagramIcon, PiSparkle, PiCards, PiArrowClockwise, PiX } from "react-icons/pi";
import { TbZodiacAries, TbZodiacTaurus, TbZodiacGemini, TbZodiacCancer, TbZodiacLeo, TbZodiacVirgo, TbZodiacLibra, TbZodiacScorpio, TbZodiacSagittarius, TbZodiacCapricorn, TbZodiacAquarius, TbZodiacPisces } from "react-icons/tb";
import styles from "./uranai.module.css";

const ZODIAC = [
  ["aries", "牡羊座", "3/21–4/19", TbZodiacAries],
  ["taurus", "牡牛座", "4/20–5/20", TbZodiacTaurus],
  ["gemini", "双子座", "5/21–6/21", TbZodiacGemini],
  ["cancer", "蟹座", "6/22–7/22", TbZodiacCancer],
  ["leo", "獅子座", "7/23–8/22", TbZodiacLeo],
  ["virgo", "乙女座", "8/23–9/22", TbZodiacVirgo],
  ["libra", "天秤座", "9/23–10/23", TbZodiacLibra],
  ["scorpio", "蠍座", "10/24–11/21", TbZodiacScorpio],
  ["sagittarius", "射手座", "11/22–12/21", TbZodiacSagittarius],
  ["capricorn", "山羊座", "12/22–1/19", TbZodiacCapricorn],
  ["aquarius", "水瓶座", "1/20–2/18", TbZodiacAquarius],
  ["pisces", "魚座", "2/19–3/20", TbZodiacPisces],
];
const FORTUNES = [["overall", "全体運"], ["love", "恋愛運"], ["work", "仕事運"], ["health", "健康運"]];
const SPREADS = [[1, "1枚引き", "今日のヒント"], [3, "3枚引き", "過去・現在・未来"], [5, "5枚引き", "じっくり読み解く"], [10, "10枚引き", "ケルト十字"]];
const tokyoDate = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function DailyDivination() {
  const [activeTab, setActiveTab] = useState("horoscope");
  const [selectedSign, setSelectedSign] = useState(null);
  const [horoscope, setHoroscope] = useState(null);
  const [tarotCount, setTarotCount] = useState(3);
  const [tarotDraw, setTarotDraw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [date, setDate] = useState("");
  const pending = useRef(null);
  const cache = useRef(new Map());

  useEffect(() => {
    setDate(tokyoDate());
    return () => pending.current?.abort();
  }, []);

  const cancelRequest = () => {
    pending.current?.abort();
    pending.current = null;
    setLoading(false);
    setError(null);
  };

  const request = async (url, accept) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "取得できませんでした。再試行してください。");
      if (pending.current === controller) accept(json);
    } catch (err) {
      if (pending.current === controller) {
        setError(err.name === "AbortError" ? "読み込みに時間がかかっています。もう一度お試しください。" : err.message || "取得できませんでした。もう一度お試しください。");
      }
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  };

  const selectSign = (id) => {
    const today = tokyoDate();
    const key = `${today}:${id}`;
    cancelRequest();
    setDate(today);
    setSelectedSign(id);
    setHoroscope(null);
    if (cache.current.has(key)) {
      setHoroscope(cache.current.get(key));
      return;
    }
    const query = new URLSearchParams({ sign: id, date: today, timezone: "Asia/Tokyo" });
    request(`/api/uranai/daily-horoscope?${query}`, (json) => {
      if (!json.data?.fortune) throw new Error("Invalid horoscope");
      cache.current.set(key, json.data);
      setHoroscope(json.data);
    });
  };

  const drawTarot = () => {
    setTarotDraw(null);
    request(`/api/uranai/tarot?count=${tarotCount}`, (json) => {
      if (!Array.isArray(json.draw) || json.draw.length !== tarotCount) throw new Error("Invalid tarot draw");
      setTarotDraw(json);
    });
  };

  const switchTab = (tab) => {
    cancelRequest();
    setActiveTab(tab);
  };
  const resetSign = () => {
    cancelRequest();
    setSelectedSign(null);
    setHoroscope(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1><PentagramIcon size={28} aria-hidden="true" />星の歌に耳を澄ませて</h1>
          <span className={styles.date}>{date.replaceAll("-", " / ")}</span>
        </header>

        <div className={styles.tabs} aria-label="占いの種類">
          <button type="button" aria-pressed={activeTab === "horoscope"} onClick={() => switchTab("horoscope")}><PiSparkle size={22} aria-hidden="true" />星占い</button>
          <button type="button" aria-pressed={activeTab === "tarot"} onClick={() => switchTab("tarot")}><PiCards size={22} aria-hidden="true" />タロット</button>
        </div>

        {activeTab === "horoscope" ? (
          <section className={styles.panel} aria-label="星占い">
            <div className={selectedSign ? styles.selectedGrid : styles.zodiacGrid}>
              {ZODIAC.filter(([id]) => !selectedSign || id === selectedSign).map(([id, name, dates, Icon]) => {
                const flipped = selectedSign === id && Boolean(horoscope);
                return (
                  <div key={id} className={`${styles.flipCard} ${selectedSign ? styles.expanded : ""}`} aria-busy={loading}>
                    <div className={`${styles.flipInner} ${flipped ? styles.flipped : ""}`}>
                      <div className={styles.front} aria-hidden={flipped} {...(flipped ? { inert: true } : {})}>
                        {!loading && <button type="button" className={styles.zodiac} onClick={() => selectSign(id)} aria-label={`${name}の運勢を見る`}>
                          <Icon size={52} aria-hidden="true" /><strong>{name}</strong><span>{dates}</span>
                        </button>}
                        {loading && <div className={styles.listening} role="status"><PiSparkle size={36} aria-hidden="true" /><p>星の声に耳を澄ませています…</p></div>}
                        {error && <div className={styles.cardStatus} role="alert"><p>{error}</p><button type="button" className={styles.primary} onClick={() => selectSign(id)}>再試行</button></div>}
                        {selectedSign && !flipped && <button type="button" className={styles.close} onClick={resetSign} aria-label="星座一覧に戻る"><PiX size={20} /></button>}
                      </div>
                      <div className={styles.back} aria-hidden={!flipped} {...(!flipped ? { inert: true } : {})}>
                        <button type="button" className={styles.close} onClick={resetSign} aria-label="星座一覧に戻る"><PiX size={20} /></button>
                        {flipped && <div className={styles.cardContent}>
                          <div className={styles.resultHeading}><h2>{horoscope.signName}</h2><p>{horoscope.date} · Prokerala</p></div>
                          <div className={styles.fortunes}>{FORTUNES.map(([key, label]) => <article key={key}><h3>{label}</h3><p lang={horoscope.language}>{horoscope.fortune[key]}</p></article>)}</div>
                        </div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className={`${styles.panel} ${styles.tarotPanel}`} aria-labelledby="tarot-heading" aria-busy={loading}>
            <h2 id="tarot-heading" className={styles.tarotTitle}>タロット</h2>
            <div className={styles.spreads} aria-label="引くカードの枚数">{SPREADS.map(([count, title, detail]) => <button type="button" key={count} disabled={loading} aria-pressed={tarotCount === count} onClick={() => { setTarotCount(count); setTarotDraw(null); setError(null); }}><strong>{title}</strong><span>{detail}</span></button>)}</div>
            <div className={styles.drawAction}><button type="button" className={styles.primary} disabled={loading} onClick={drawTarot}>{tarotDraw ? <PiArrowClockwise size={20} aria-hidden="true" /> : <PiCards size={20} aria-hidden="true" />}{loading ? "シャッフル中…" : tarotDraw ? "もう一度引く" : `${tarotCount}枚のカードを引く`}</button></div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {loading && <div className={styles.empty} role="status"><span className={styles.loader} /><p>シャッフル中…</p></div>}
            {tarotDraw ? <div className={styles.tarotGrid}>{tarotDraw.draw.map((card, index) => <article key={`${index}:${card.id}`} className={styles.tarotCard}><div className={styles.cardTop}><span>{tarotDraw.count === 3 ? ["過去", "現在", "未来"][index] : `カード ${card.position}`}</span><span className={card.reversed ? styles.reversed : styles.upright}>{card.interpretation}</span></div><div className={styles.cardSymbol}><PentagramIcon size={44} aria-hidden="true" /></div><h3>{card.name}</h3><p>{card.meaning}</p></article>)}</div> : !loading && !error && <div className={styles.tarotEmpty}><PiCards size={56} aria-hidden="true" /></div>}
          </section>
        )}

      </div>
    </main>
  );
}
