import { useMemo, useState } from "react";
import { useScrollProgress } from "./hooks";
import { ASSET_NAME, ASSET_ORDER, BAND, LEVEL, LEVELS, shown, toLines, WHO, type AssetKey, type Board, type Level, type Line } from "../research/demoData";
import { byline } from "../research/useBoard";

/**
 * Pinned scroll story on a phone. The screens mirror the real dashboard as it looks on a phone
 * (same cards, score meter, plain-words box and agent conversation), filled with the latest real ratings.
 */

const STEPS = [
  { k: "01", t: "Today, at a glance", d: "Five markets, each with a rating, a 0 to 100 score and one plain sentence." },
  { k: "02", t: "Tap one to see why", d: "See the score in context, the price chart and the reasons, each tied to real data." },
  { k: "03", t: "See who checked it", d: "Read the actual conversation: one AI makes the call, a different AI checks it." },
  { k: "04", t: "Fresh every day", d: "The agents take a fresh look every day, and the page tells you when the next one is." },
];

type Row = { key: AssetKey; level: Level; score: number; summary: string; swing: number; usual?: number; price?: number; change?: number | null; by: string };

// Fallback (from a real run) for when the backend isn't reachable
const FALLBACK: Row[] = [
  { key: "BTC-USD", level: "HIGH", score: 62, summary: "Bitcoin's recent big swings suggest higher than usual risk this week.", swing: 1.39, usual: 1.47, price: 73166.52, change: -2.73, by: "Rated by gpt-oss-120b · checked by Qwen 3.8" },
  { key: "ETH-USD", level: "LOW", score: 15, summary: "Ethereum's price moves are calmer than usual this week.", swing: 1.87, usual: 2, price: 2026.79, change: -4.91, by: "Rated by gpt-oss-120b · checked by Qwen 3.8" },
  { key: "SPY", level: "MEDIUM", score: 45, summary: "The S&P 500's daily moves are a bit larger than usual.", swing: 0.78, usual: 0.5, price: 745.95, change: -0.9, by: "Rated by gpt-oss-120b · checked by Qwen 3.8" },
  { key: "GC=F", level: "MEDIUM", score: 38, summary: "Gold's daily swings are a bit above normal, but not extreme.", swing: 1.04, usual: 0.51, price: 4027.1, change: -2.12, by: "Rated by gpt-oss-120b · checked by Qwen 3.8" },
  { key: "EURUSD=X", level: "LOW", score: 15, summary: "EUR/USD is moving less than usual, indicating calmer conditions.", swing: 0.24, usual: 0.26, price: 1.1159, change: 0.11, by: "Rated by gpt-oss-120b · checked by Qwen 3.8" },
];
const FALLBACK_LINES: Line[] = [
  { who: "analyst", text: "Looking at its recent daily moves", tech: "mcp · riskpulse.daily_moves(asset=BTC-USD, days=30)" },
  { who: "analyst", text: "My rating: MEDIUM (38/100). 30-day average move is 1.39% vs long-run 1.47%." },
  { who: "critic", text: "I want a rethink: Rating ignores recent 5.55% and 4.3% swings.", mood: "warn" },
  { who: "analyst", text: "My rating: HIGH (62/100). Two biggest moves in the last 30 days were -5.55% and -4.30%." },
  { who: "system", text: "Guardrails passed: valid format, every reason backed by a tool, no advice.", mood: "yes" },
];

const fmtPrice = (k: string, p?: number) => (p == null ? "" : k === "EURUSD=X" ? p.toFixed(4) : "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function Pill({ level }: { level: Level }) {
  const l = LEVEL[level];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em]" style={{ color: l.color, background: l.bg }}>
      <span className="h-1 w-1 rounded-full" style={{ background: l.color }} />{level}
    </span>
  );
}

function Meter({ score, level, labels = false }: { score: number; level: Level; labels?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className={`font-semibold leading-none ${labels ? "text-[30px]" : "text-[24px]"}`} style={{ color: LEVEL[level].color }}>{score}</span>
        <span className="mono text-[8.5px] text-ink/45">/ 100 risk score</span>
      </div>
      <div className="relative mt-1.5 flex h-1.5 gap-[2px]">
        {LEVELS.map((l) => <div key={l} className="h-full flex-1" style={{ background: LEVEL[l].bg, outline: l === level ? `1px solid ${LEVEL[l].color}` : undefined }} />)}
        <div className="absolute -top-[2px] h-[10px] w-[2px] rounded-full" style={{ left: `${score}%`, background: LEVEL[level].color }} />
      </div>
      {labels && <div className="mt-1 grid grid-cols-4 gap-[2px] mono text-[7px] leading-tight text-ink/50">{LEVELS.map((l) => <span key={l}>{BAND[l][0]}-{BAND[l][1]}</span>)}</div>}
    </div>
  );
}

/** Same layout as a market card on the real dashboard, scaled for the mockup. */
function Card({ r, selected = false }: { r: Row; selected?: boolean }) {
  return (
    <div className={`border-2 bg-white/50 p-3 ${selected ? "border-ink" : "border-ink/10"}`}>
      <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold">{ASSET_NAME[r.key]}</span><span className="mono text-[8px] text-ink/45">{r.key}</span></div>
      {r.price != null && (
        <p className="mono text-[11px] font-semibold">{fmtPrice(r.key, r.price)} {r.change != null && <span className="text-[9px] font-medium" style={{ color: r.change >= 0 ? "#0A8F5A" : "#E0412A" }}>{r.change >= 0 ? "+" : ""}{r.change.toFixed(2)}%</span>}</p>
      )}
      <div className="mt-2 flex items-center gap-1.5"><Pill level={r.level} /><span className="text-[9.5px] text-ink/60">{LEVEL[r.level].plain}</span></div>
      <div className="mt-2"><Meter score={r.score} level={r.level} /></div>
      <p className="mt-2 text-[10.5px] leading-snug text-ink/80">{r.summary}</p>
      <div className="mt-2 flex justify-between text-[9px] text-ink/60"><span>Moves about <b className="mono text-ink">±{r.swing}%</b> a day</span><span>usually ±{r.usual ?? "?"}%</span></div>
      <p className="mt-1.5 border-t border-ink/10 pt-1.5 mono text-[7.5px] text-ink/50">{r.by}</p>
    </div>
  );
}

export function PhoneSection({ board }: { board?: Board | null }) {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const raw = p * 4.4;
  const stage = Math.min(3, Math.floor(raw));
  const local = Math.max(0, Math.min(1, raw - stage)); // progress within the current step
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const live = (board?.results ?? []).filter(shown);
  const rows: Row[] = useMemo(() => {
    if (!live.length) return FALLBACK;
    const by = new Map(live.map((r) => [r.asset, r]));
    return ASSET_ORDER.filter((k) => by.has(k)).map((k) => {
      const r = by.get(k)!, c = board?.charts?.[k];
      return { key: k, level: r.rating.level as Level, score: Math.round(r.rating.score ?? BAND[r.rating.level as Level][0]), summary: r.rating.summary ?? LEVEL[r.rating.level as Level].plain,
        swing: r.rating.daily_swing_pct ?? 0, usual: c?.long_run_typical_abs_move_pct, price: c?.last_price, change: c?.change_1d_pct, by: byline(r) };
    });
  }, [board]); // eslint-disable-line react-hooks/exhaustive-deps

  const feat = rows[0];
  const featResult = live.find((r) => r.asset === feat.key);
  const reasons = featResult?.rating?.reasons?.map((x) => x.claim) ?? ["Two biggest moves in the last 30 days were -5.55% and -4.30%, far above typical 1.47%"];
  // first tool call, then the last few spoken turns (answers, critique, guardrails)
  const all = featResult ? toLines(featResult) : FALLBACK_LINES;
  const firstTool = all.find((l) => l.tech?.startsWith("mcp"));
  const lines = [...(firstTool ? [firstTool] : []), ...all.filter((l) => !l.tech?.startsWith("mcp")).slice(-4)];
  const chart = board?.charts?.[feat.key]?.points?.slice(-60) ?? [100, 101, 99, 102, 104, 103, 106, 105, 108, 107, 104, 101, 103, 100, 97, 99, 96, 98];
  const lo = Math.min(...chart), hi = Math.max(...chart);
  const path = chart.map((v, i) => `${i ? "L" : "M"}${(i / (chart.length - 1)) * 220},${56 - ((v - lo) / (hi - lo || 1)) * 50}`).join("");
  const updated = board?.finished_at ? new Date(board.finished_at * 1000) : null;
  const next = board?.next_run_utc ? new Date(board.next_run_utc) : null;
  const hoursLeft = next ? Math.max(0, (next.getTime() - Date.now()) / 3.6e6) : 8;
  const calls = board?.usage?.calls ?? 25, maxCalls = board?.usage?.max_calls ?? 45;

  const screen = (n: number) => `absolute inset-0 overflow-hidden transition-all duration-500 ${stage === n ? "opacity-100 translate-x-0" : stage > n ? "opacity-0 -translate-x-6 pointer-events-none" : "opacity-0 translate-x-6 pointer-events-none"}`;
  const appear = (on: boolean, i: number) => ({ transition: "all .5s cubic-bezier(.16,1,.3,1)", transitionDelay: `${i * 120}ms`, opacity: on ? 1 : 0, transform: on ? "none" : "translateY(8px)" });

  return (
    <section ref={ref} id="phone" className="relative bg-paper" style={{ height: "240vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 14, y: -((e.clientY - r.top) / r.height - 0.5) * 8 }); }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
        <div className="mx-auto grid h-full max-w-[1400px] grid-cols-12 items-center gap-6 px-4 pt-14 sm:px-8">
          <div className="col-span-12 hidden lg:col-span-6 lg:block">
            <p className="mono text-[10.5px] tracking-[0.18em] text-ink/65">ON YOUR PHONE</p>
            <h2 className="serif mt-4 text-[60px] leading-[0.95]">A quick daily check-in,<br /><em className="text-up">right from your phone.</em></h2>
            <ol className="mt-8 border-t border-ink">
              {STEPS.map((s, i) => (
                <li key={s.k} className="grid grid-cols-[40px_1fr] gap-x-3 border-b border-ink/15 py-3">
                  <span className={`mono pt-1.5 text-[11px] tracking-[0.14em] transition-colors ${i === stage ? "text-ink" : "text-ink/40"}`}>{s.k}</span>
                  <div>
                    <p className={`text-[20px] font-medium tracking-[-0.02em] transition-colors duration-300 ${i === stage ? "text-ink" : "text-ink/30"}`}>{s.t}</p>
                    <p className={`overflow-hidden text-[14.5px] leading-relaxed text-ink/75 transition-all duration-500 ${i === stage ? "mt-1 max-h-16 opacity-100" : "max-h-0 opacity-0"}`}>{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] text-ink/55">This is the real dashboard as it looks on a phone, with today's ratings. No app to install.</p>
          </div>

          <div className="col-span-12 flex flex-col items-center justify-center lg:col-span-6" style={{ perspective: "1400px" }}>
            <div className="mb-4 text-center lg:hidden">
              <p className="mono text-[10px] tracking-[0.18em] text-ink/65">{STEPS[stage].k} / 04</p>
              <p className="serif mt-1 text-[30px] leading-none">{STEPS[stage].t}</p>
            </div>
            <div className="relative rp-float" style={{ transform: `rotateY(${(0.5 - p) * 24 + tilt.x}deg) rotateX(${5 + tilt.y}deg)`, transformStyle: "preserve-3d", transition: "transform .25s ease-out" }}>
              <div className="absolute -bottom-10 left-1/2 h-10 w-[70%] -translate-x-1/2 rounded-[50%] bg-ink/25 blur-2xl" />
              <div className="relative h-[580px] w-[284px] origin-top scale-[0.82] rounded-[50px] bg-ink p-[11px] shadow-[inset_0_0_0_1.5px_#3a3b36,0_40px_80px_-30px_rgba(14,15,12,.55)] sm:scale-100">
                <div className="relative h-full w-full overflow-hidden rounded-[40px] bg-paper">
                  <div className="absolute left-1/2 top-[10px] z-30 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-ink" />
                  {/* the dashboard's top bar */}
                  <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 border-b border-ink/10 bg-paper px-4 pb-2 pt-[44px]">
                    <span className="h-3.5 w-3.5 rounded-[4px] bg-ink" />
                    <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] text-paper">Today's ratings</span>
                    <span className="text-[9px] text-ink/60">How</span>
                    <span className="ml-auto flex items-center gap-1 rounded-full border border-ink/15 px-1.5 py-0.5 mono text-[8px]"><span className="h-1 w-1 rounded-full bg-up" />{calls}/{maxCalls}</span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 top-[78px]">
                    {/* 1 · the cards */}
                    <div className={screen(0)}>
                      <div className="space-y-2 px-3.5 pt-3" style={{ transform: `translateY(${-local * 520}px)`, transition: "transform .2s linear" }}>
                        <p className="mono text-[7.5px] tracking-[0.14em] text-ink/55">RISK FOR THE NEXT 7 DAYS · RATED BY AI AGENTS</p>
                        <p className="serif text-[22px] leading-[0.95]">Here's how things look this week</p>
                        {rows.map((r, i) => <div key={r.key} style={appear(stage === 0, i)}><Card r={r} selected={i === 0} /></div>)}
                      </div>
                    </div>

                    {/* 2 · the detail below the cards */}
                    <div className={screen(1)}>
                      <div className="space-y-2.5 px-3.5 pt-3" style={{ transform: `translateY(${-local * 160}px)`, transition: "transform .2s linear" }}>
                        <div className="border border-ink/12 bg-white/50 p-3">
                          <p className="mono text-[7.5px] tracking-[0.14em] text-ink/60">{ASSET_NAME[feat.key].toUpperCase()} · LAST 120 TRADING DAYS</p>
                          <p className="mt-1 text-[13px] font-semibold">Rated <Pill level={feat.level} /> for the next 7 days</p>
                          <div className="mt-2.5 border-y border-ink/10 py-2.5" style={appear(stage === 1, 1)}><Meter score={feat.score} level={feat.level} labels /></div>
                          <div className="mt-2.5" style={appear(stage === 1, 2)}>
                            <p className="mono text-[7.5px] tracking-[0.14em] text-ink/60">IN PLAIN WORDS</p>
                            <p className="mt-0.5 text-[11.5px] leading-snug">{feat.summary}</p>
                          </div>
                          <svg viewBox="0 0 220 60" className="mt-2.5 h-[60px] w-full"><path d={path} fill="none" stroke="#0E0F0C" strokeWidth="1.5" className="rp-chart" style={{ strokeDashoffset: stage === 1 ? 0 : 520 }} /></svg>
                        </div>
                        <div className="border border-ink/12 bg-white/50 p-3" style={appear(stage === 1, 4)}>
                          <p className="mono text-[7.5px] tracking-[0.14em] text-ink/60">WHY THE AGENTS CHOSE THIS</p>
                          <ul className="mt-1.5 space-y-1.5">{reasons.slice(0, 2).map((t, i) => <li key={i} className="flex gap-1.5 text-[10.5px] leading-snug"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ink" />{t}</li>)}</ul>
                        </div>
                      </div>
                    </div>

                    {/* 3 · the agents' conversation */}
                    <div className={screen(2)}>
                      <div className="px-3.5 pt-3">
                        <div className="border border-ink/12 bg-white/50 p-3">
                          <p className="mono text-[7.5px] tracking-[0.14em] text-ink/60">HOW THE AGENTS GOT THERE · {ASSET_NAME[feat.key].toUpperCase()}</p>
                          <div className="mt-2 space-y-2">
                            {lines.map((l, i) => (
                              <div key={i} style={appear(stage === 2, i)}>
                                <p className="text-[9px] font-semibold" style={{ color: l.mood === "yes" ? "#0A8F5A" : WHO[l.who].color }}>{WHO[l.who].name}</p>
                                <div className={`mt-0.5 rounded-lg px-2.5 py-1.5 text-[10px] leading-snug ${l.mood === "yes" ? "bg-up/10" : l.mood === "warn" ? "bg-signal/15" : "bg-ink/[0.06]"}`}>{l.text.length > 150 ? l.text.slice(0, 147) + "…" : l.text}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4 · when it was updated, when it updates next */}
                    <div className={screen(3)}>
                      <div className="space-y-2.5 px-3.5 pt-3">
                        <p className="mono text-[7.5px] leading-relaxed tracking-[0.14em] text-ink/55">RISK FOR THE NEXT 7 DAYS · UPDATED {updated ? updated.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }).toUpperCase() : "TODAY"}</p>
                        <div className="grid place-items-center border border-ink/12 bg-white/50 py-5" style={appear(stage === 3, 0)}>
                          <svg width="128" height="128" viewBox="0 0 128 128">
                            <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(14,15,12,.1)" strokeWidth="5" />
                            <circle cx="64" cy="64" r="56" fill="none" stroke="#0A8F5A" strokeWidth="5" strokeLinecap="round" transform="rotate(-90 64 64)"
                              strokeDasharray={`${2 * Math.PI * 56}`} strokeDashoffset={stage === 3 ? 2 * Math.PI * 56 * (hoursLeft / 24) : 2 * Math.PI * 56} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)" }} />
                            <text x="64" y="62" textAnchor="middle" className="serif" fontSize="26" fill="#0E0F0C">{Math.floor(hoursLeft)}h {Math.round((hoursLeft % 1) * 60)}m</text>
                            <text x="64" y="80" textAnchor="middle" fontSize="8" fill="rgba(14,15,12,.55)" fontFamily="JetBrains Mono, monospace">UNTIL THE NEXT LOOK</text>
                          </svg>
                          <p className="mt-2 text-[10.5px] text-ink/65">Next update {next ? next.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "tomorrow morning"}</p>
                        </div>
                        <div className="border border-ink/12 bg-white/50 p-3" style={appear(stage === 3, 2)}>
                          <div className="flex items-center justify-between text-[10.5px]"><span className="font-semibold">AI usage today</span><span className="mono">{calls}/{maxCalls} calls</span></div>
                          <div className="mt-1.5 h-1.5 bg-ink/[0.07]"><div className="h-full bg-ink" style={{ width: `${(calls / maxCalls) * 100}%` }} /></div>
                          <p className="mt-1.5 text-[9.5px] text-ink/60">A strict daily budget keeps it free and fair. Cost so far: $0.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="absolute bottom-0 left-0 right-0 z-20 bg-paper pb-[14px] pt-2 text-center text-[10px] text-ink/45">For learning only · not financial advice</p>
                  <div className="absolute bottom-[6px] left-1/2 z-30 h-[4px] w-[100px] -translate-x-1/2 rounded-full bg-ink/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
