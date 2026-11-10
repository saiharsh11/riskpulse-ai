import { useEffect, useMemo, useRef, useState } from "react";
import { AgentMark } from "../landing/Mark";
import "../landing/landing.css";
import { ASSET_NAME, ASSET_ORDER, BAND, LEVEL, LEVELS, shown, toLines, WHO, type AssetKey, type Board, type Chart, type Level, type Line, type Result } from "./demoData";
import { byline, freshness, useBoard } from "./useBoard";

type Tab = "board" | "how";
const TABS: [Tab, string][] = [["board", "Today's ratings"], ["how", "How it works"]];

/* ───────────────────────── shared bits ───────────────────────── */
function fmtPrice(asset: string, p?: number) {
  if (p == null) return "";
  if (asset === "EURUSD=X") return p.toFixed(4);
  return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Today's price and the move since yesterday's close: plain data, no judgement. */
function PriceLine({ asset, chart }: { asset: string; chart?: Chart }) {
  if (chart?.last_price == null) return null;
  const ch = chart.change_1d_pct;
  return (
    <div className="flex items-baseline gap-2">
      <span className="mono text-[15px] font-semibold text-ink">{fmtPrice(asset, chart.last_price)}</span>
      {ch != null && <span className="mono text-[12px] font-medium" style={{ color: ch >= 0 ? "#0A8F5A" : "#E0412A" }}>{ch >= 0 ? "+" : ""}{ch.toFixed(2)}%</span>}
    </div>
  );
}

/** The agent's 0-100 risk score on a four-band track (calm → roughest). */
function ScoreMeter({ score, level, big = false }: { score: number; level: Level; big?: boolean }) {
  const s = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className={`font-semibold leading-none ${big ? "text-[44px]" : "text-[32px]"}`} style={{ color: LEVEL[level].color }}>{Math.round(s)}</span>
        <span className="mono text-[11px] text-ink/45">/ 100 risk score</span>
      </div>
      <div className="relative mt-2 flex h-2 gap-[2px]">
        {LEVELS.map((l) => <div key={l} className="h-full flex-1" style={{ background: LEVEL[l].bg, outline: l === level ? `1px solid ${LEVEL[l].color}` : undefined }} />)}
        <div className="absolute -top-[3px] h-[14px] w-[3px] rounded-full transition-all duration-700" style={{ left: `calc(${s}% - 1.5px)`, background: LEVEL[level].color }} />
      </div>
      {big && (
        <div className="mt-1 grid grid-cols-4 gap-[2px] mono text-[9.5px] text-ink/50">
          {LEVELS.map((l) => <span key={l}>{BAND[l][0]}-{BAND[l][1]} {LEVEL[l].plain.toLowerCase()}</span>)}
        </div>
      )}
    </div>
  );
}

function LevelPill({ level, big = false }: { level: Level; big?: boolean }) {
  const l = LEVEL[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-[0.06em] ${big ? "px-3 py-1 text-[13px]" : "px-2 py-0.5 text-[10.5px]"}`} style={{ color: l.color, background: l.bg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />{level}
    </span>
  );
}

function Bar({ value, max, color, h = 8 }: { value: number; max: number; color: string; h?: number }) {
  return <div className="w-full bg-ink/[0.07]" style={{ height: h }}><div className="h-full transition-all duration-700" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color }} /></div>;
}

function Conversation({ lines }: { lines: Line[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: 0 }); }, [lines]);
  if (!lines.length) return <p className="py-10 text-center text-[14px] text-ink/55">Nothing here yet. The agents' conversation will appear once they've finished.</p>;
  return (
    <div ref={box} className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
      {lines.map((e, k) => (
        <div key={k} className="rp-fadein">
          <p className="text-[12px] font-semibold" style={{ color: WHO[e.who].color }}>{WHO[e.who].name}</p>
          <div className={`mt-1 rounded-xl px-3.5 py-2.5 ${e.mood === "yes" ? "bg-up/10" : e.mood === "warn" ? "bg-signal/15" : e.mood === "no" ? "bg-down/10" : "bg-ink/[0.05]"}`}>
            <p className="text-[15px] leading-snug">{e.mood === "warn" ? "⚠ " : ""}{e.text}</p>
            {e.tech && <p className="mt-1 mono text-[11px] text-ink/50 break-words">{e.tech}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PriceChart({ chart }: { chart?: Chart }) {
  if (!chart?.points?.length) return <p className="py-12 text-center text-[13px] text-ink/50">{chart?.error ? "Price data unavailable right now." : "Loading prices…"}</p>;
  const data = chart.points;
  const W = 700, H = 200, P = 8;
  const lo = Math.min(...data), hi = Math.max(...data);
  const X = (i: number) => P + (i / (data.length - 1)) * (W - 2 * P);
  const Y = (v: number) => P + (1 - (v - lo) / (hi - lo || 1)) * (H - 2 * P);
  const d = data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Price, last 120 trading days">
        <path d={d} fill="none" stroke="#0E0F0C" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={X(data.length - 1)} cy={Y(data[data.length - 1])} r="3.5" fill="#E0412A" />
      </svg>
      <div className="mt-1 flex justify-between mono text-[10.5px] text-ink/50"><span>{chart.from}</span><span>{chart.to}</span></div>
    </div>
  );
}

function StatusBanner({ board, offline }: { board: Board | null; offline: boolean }) {
  if (offline) return <div className="border-l-4 border-down bg-down/10 p-4 text-[14px]"><b>We can't reach the ratings right now.</b> Please try again in a moment.{import.meta.env.DEV && <> (Developers: start the backend with <span className="mono">uvicorn riskpulse.api:app --port 8001</span>.)</>}</div>;
  if (!board || board.status === "starting" || board.status === "running") {
    const secs = board?.started_at ? Math.round(Date.now() / 1000 - board.started_at) : 0;
    return <div className="border-l-4 border-signal bg-signal/15 p-4 text-[14px]"><b>The agents are preparing today's ratings.</b> This usually takes a couple of minutes, and the page will update by itself.{secs ? <span className="mono text-ink/60"> · {secs}s</span> : null}</div>;
  }
  if (board.status === "error") return <div className="border-l-4 border-down bg-down/10 p-4 text-[14px]"><b>Sorry, today's update didn't finish.</b> We'll try again shortly.{import.meta.env.DEV && board.error ? ` (${board.error})` : ""}</div>;
  if ((board as Board & { refreshing?: boolean }).refreshing) return <p className="mono text-[11px] tracking-[0.12em] text-ink/55"><span className="rp-blink">●</span> THE AGENTS ARE TAKING A FRESH LOOK · SHOWING THE LATEST RATINGS IN THE MEANTIME</p>;
  return null;
}

/* ───────────────────────── API meter ───────────────────────── */
function ApiMeter({ board }: { board: Board | null }) {
  const [open, setOpen] = useState(false);
  const u = board?.usage ?? {};
  const calls = u.calls ?? 0, maxCalls = u.max_calls ?? 45;
  const near = calls / maxCalls > 0.8;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2 rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] hover:border-ink/40">
        <span className={`h-1.5 w-1.5 rounded-full ${near ? "bg-signal" : "bg-up"}`} />
        <span className="hidden sm:inline">AI usage</span>
        <span className="mono tabular-nums">{calls}/{maxCalls}</span>
        <span className="h-1.5 w-12 bg-ink/10"><span className="block h-full bg-ink" style={{ width: `${Math.min(100, (calls / maxCalls) * 100)}%` }} /></span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] max-w-[90vw] border border-ink/15 bg-paper p-5 shadow-xl rp-fadein">
          <div className="flex items-center justify-between">
            <p className="mono text-[10px] tracking-[0.16em] text-ink/60">API METER · LAST RUN</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${near ? "bg-signal/25 text-[#7a5200]" : "bg-up/15 text-up"}`}>{near ? "Near limit" : "Healthy"}</span>
          </div>
          <div className="mt-4 space-y-3">
            <div><div className="flex justify-between text-[13px]"><span>AI model calls</span><span className="mono">{calls} / {maxCalls}</span></div><div className="mt-1"><Bar value={calls} max={maxCalls} color="#0E0F0C" /></div></div>
            <div><div className="flex justify-between text-[13px]"><span>Tokens</span><span className="mono">{((u.tokens ?? 0) / 1000).toFixed(1)}k / {((u.max_tokens ?? 90000) / 1000).toFixed(0)}k</span></div><div className="mt-1"><Bar value={u.tokens ?? 0} max={u.max_tokens ?? 90000} color="#0E0F0C" /></div></div>
            <div className="flex justify-between text-[13px]"><span>Cost</span><span className="mono">$0.00 (free tiers)</span></div>
          </div>
          <p className="mt-4 mono text-[10px] tracking-[0.14em] text-ink/55">CALLS BY AGENT</p>
          <div className="mt-2 space-y-1.5">
            {Object.entries(u.by_agent ?? {}).map(([a, n]) => (
              <div key={a} className="grid grid-cols-[110px_1fr_32px] items-center gap-2 text-[12px]">
                <span style={{ color: WHO[a as keyof typeof WHO]?.color }}>{WHO[a as keyof typeof WHO]?.name.replace(" agent", "") ?? a}</span>
                <Bar value={n} max={Math.max(...Object.values(u.by_agent ?? { x: 1 }))} color={WHO[a as keyof typeof WHO]?.color ?? "#0E0F0C"} h={6} />
                <span className="mono text-right">{n}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-ink/10 pt-3 text-[12px] leading-relaxed text-ink/70">
            {Object.entries(board?.models ?? {}).map(([a, ms]) => <span key={a} className="block"><b style={{ color: WHO[a as keyof typeof WHO]?.color }}>{WHO[a as keyof typeof WHO]?.name.replace(" agent", "") ?? a}:</b> {ms.join(" → ")}</span>)}Next run: {board?.next_run_utc ? new Date(board.next_run_utc).toUTCString().slice(0, 22) + " UTC" : "n/a"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── risk board ───────────────────────── */
function RiskBoard({ board, offline }: { board: Board | null; offline: boolean }) {
  const results = useMemo(() => {
    const by = new Map((board?.results ?? []).map((r) => [r.asset, r]));
    return ASSET_ORDER.map((k) => by.get(k)).filter(Boolean) as Result[];
  }, [board]);
  const [sel, setSel] = useState<AssetKey>("BTC-USD");
  const r = results.find((x) => x.asset === sel) ?? results[0];
  const lines = useMemo(() => (r ? toLines(r) : []), [r]);
  const chart = r ? board?.charts?.[r.asset] : undefined;
  const rt = shown(r) ? r!.rating : {};
  const ready = board?.status === "ready";

  return (
    <div className="space-y-6">
      <div>
        <p className="mono text-[10.5px] tracking-[0.16em] text-ink/60">RISK FOR THE NEXT 7 DAYS · RATED BY AI AGENTS{board?.finished_at ? ` · UPDATED ${new Date(board.finished_at * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}{board?.next_run_utc ? ` · NEXT UPDATE ${new Date(board.next_run_utc).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
        <h1 className="serif mt-1 text-[38px] sm:text-[52px] leading-[0.95]">Here's how things look this week</h1>
        <p className="mt-2 max-w-[780px] text-[15px] text-ink/70">Our AI agents looked at each market using real prices and rated how steady or lively the coming week is likely to be, compared with what's normal for that market. Pick a market to see how they decided.</p>
      </div>
      <StatusBanner board={board} offline={offline} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ASSET_ORDER.map((k) => {
          const x = results.find((y) => y.asset === k);
          const lvl = shown(x) ? x?.rating?.level : undefined;
          return (
            <button key={k} onClick={() => setSel(k)} aria-pressed={sel === k} disabled={!x}
              className={`flex flex-col lg:min-h-[300px] border-2 bg-white/50 p-4 text-left transition-all hover:-translate-y-0.5 ${sel === k ? "border-ink" : "border-ink/10"}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-[16px] font-semibold">{ASSET_NAME[k]}</span><span className="mono text-[10px] text-ink/45">{k}</span></div>
              <div className="mt-1"><PriceLine asset={k} chart={board?.charts?.[k]} /></div>
              {lvl ? (
                <>
                  <div className="mt-3 flex items-center gap-2"><LevelPill level={lvl} big /><span className="text-[12.5px] text-ink/60">{LEVEL[lvl].plain}</span></div>
                  {typeof x?.rating?.score === "number" && <div className="mt-3"><ScoreMeter score={x.rating.score} level={lvl} /></div>}
                  <p className="mt-3 text-[13.5px] leading-snug text-ink/80">{x?.rating?.summary ?? x?.rating?.reasons?.[0]?.claim}</p>
                  {x?.critic?.unresolved && <p className="mt-2 text-[11.5px] text-[#9A7400]">The critic had doubts about this one.</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 pt-3 text-[12px] text-ink/60">
                    <span>Moves about <b className="mono text-ink">±{x?.rating?.daily_swing_pct}%</b> a day</span>
                    <span>usually ±{board?.charts?.[k]?.long_run_typical_abs_move_pct ?? "?"}%</span>
                  </div>
                  <p className="mt-2 border-t border-ink/10 pt-2 mono text-[10px] leading-snug text-ink/50">{byline(x)}</p>
                </>
              ) : (
                <p className="mt-4 text-[13px] text-ink/55">{x ? (x.error ? "We couldn't rate this one today. It will be tried again tomorrow." : "This rating didn't pass our checks, so we're not showing it.") : ready ? "No rating yet." : "Being rated…"}</p>
              )}
            </button>
          );
        })}
      </div>

      {r && (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <section className="border border-ink/12 bg-white/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="mono text-[10px] tracking-[0.16em] text-ink/60">{r.name.toUpperCase()} · LAST 120 TRADING DAYS · REAL PRICES</p>
                  <p className="mono text-[10px] text-ink/50">{byline(r)}</p>
                  {rt.level && <p className="mt-1 text-[22px] font-semibold">Rated <LevelPill level={rt.level} /> for the next 7 days</p>}
                </div>
                <div className="text-right text-[13px] text-ink/65">
                  Expected daily swing <b className="mono text-ink">±{rt.daily_swing_pct ?? "n/a"}%</b><br />
                  Normal for {r.name}: <span className="mono">±{chart?.long_run_typical_abs_move_pct ?? "n/a"}%</span>
                </div>
              </div>
              {rt.level && typeof rt.score === "number" && (
                <div className="mt-4 grid gap-4 border-y border-ink/10 py-4 sm:grid-cols-[1fr_1.4fr]">
                  <ScoreMeter score={rt.score} level={rt.level} big />
                  <div>
                    <p className="mono text-[10px] tracking-[0.16em] text-ink/60">IN PLAIN WORDS</p>
                    <p className="mt-1 text-[16px] leading-snug">{rt.summary ?? LEVEL[rt.level].plain}</p>
                    <p className="mt-2 text-[12.5px] text-ink/55">Confidence: {rt.confidence}. This describes how much prices may move, not which way. It's a research project, not advice.</p>
                  </div>
                </div>
              )}
              <div className="mt-4"><PriceChart chart={chart} /></div>
            </section>
            <section className="border border-ink/12 bg-white/50 p-5">
              <p className="mono text-[10px] tracking-[0.16em] text-ink/60">WHY THE AGENTS CHOSE THIS</p>
              <ul className="mt-3 space-y-2">
                {(rt.reasons ?? []).map((x, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px]"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" /><span>{x.claim} <span className="mono text-[11px] text-ink/50">[{x.tool}]</span></span></li>
                ))}
              </ul>
              <p className="mt-4 border-t border-ink/10 pt-3 text-[13px] text-ink/60">Each reason links to the tool the agent used to find it, so you can see exactly where it came from.</p>
            </section>
          </div>
          <section className="border border-ink/12 bg-white/50 p-5 xl:col-span-5">
            <div className="flex items-center justify-between">
              <p className="mono text-[10px] tracking-[0.16em] text-ink/60">HOW THE AGENTS GOT THERE · {r.name.toUpperCase()}</p>
              <span className="mono text-[10px] text-ink/45">TOOLS VIA MCP</span>
            </div>
            <div className="mt-3"><Conversation lines={lines} /></div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── how it works ───────────────────────── */
function How({ board }: { board: Board | null }) {
  const team: [string, string, keyof typeof WHO][] = [
    ["Risk analyst", "Investigates a market with tools and proposes a risk level, with reasons.", "analyst"],
    ["Critic", "Runs on a different model and double-checks the evidence. It can ask for a rethink.", "critic"],
  ];
  const tools = ["daily_moves", "compare_assets", "find_periods", "track_record"];
  const guard = [
    ["No made-up claims", "Every reason must point to a tool the agent actually called, or the rating is rejected."],
    ["Strict answers only", "Ratings must be LOW, MEDIUM, HIGH or CRITICAL with a confidence and reasons."],
    ["Limits on every agent", "Caps on tool calls per agent, answer length, and calls and tokens per run."],
    ["Read-only tools", "Agents can only look up public market data. They can't write, run code or reach anything else."],
    ["No advice", "Answers that say buy, sell or \"you should\" are blocked."],
    ["Backup models", "If one free model is busy or down, the next one in the chain takes over."],
  ];
  const privacy = [
    ["No personal data", "No accounts, sign-ups, cookies or tracking. Nothing about visitors is stored."],
    ["Nothing from your computer", "Tools only fetch public prices from the internet. No tool can open local files."],
    ["No data kept", "Prices are held in memory for each run and discarded. The website stores nothing."],
  ];
  return (
    <div className="space-y-12">
      <h1 className="serif text-[44px] sm:text-[56px] leading-none">How it works</h1>
      <section>
        <h2 className="serif text-[30px] leading-none">The AI agent team</h2>
        <p className="mt-1.5 text-[14px] text-ink/65">The agents make every decision. Our code simply fetches the data and does the sums when an agent asks for them.</p>
        <div className="mt-5 grid gap-px overflow-hidden border border-ink/12 bg-ink/12 md:grid-cols-2">
          {team.map(([n, d, w]) => (
            <div key={n} className="bg-paper p-5">
              <span className="block h-1.5 w-8" style={{ background: WHO[w].color }} />
              <p className="mt-3 text-[18px] font-semibold">{n} agent</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink/72">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="serif text-[30px] leading-none">Tools, through MCP</h2>
          <p className="mt-1.5 text-[14px] text-ink/65">The agents use four small, read-only tools, shared through MCP (the open standard for connecting AI agents to tools). They can look things up, but they can't change anything.</p>
          <div className="mt-4 flex flex-wrap gap-2">{tools.map((t) => <span key={t} className="rounded-md border border-ink/15 bg-white/50 px-2.5 py-1.5 mono text-[12px]">{t}</span>)}</div>
          <dl className="mt-6 border-t border-ink">
            {[["AI models", Object.keys(board?.models ?? {}).length ? Object.entries(board!.models).map(([a, ms]) => `${a}: ${ms[0]}`).join(" · ") + " (each with backups)" : "A different free open-weight model per agent (Groq, OpenRouter)"], ["Prices", "Daily prices from Yahoo Finance (via yfinance), held in memory only"], ["Markets", "S&P 500 · Bitcoin · Ethereum · Gold · EUR/USD"], ["Runs on", "Backend on Railway (runs the agents daily); website on Vercel"]].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[100px_1fr] gap-4 border-b border-ink/12 py-2.5"><dt className="mono text-[10.5px] tracking-[0.12em] text-ink/55 pt-0.5">{k.toUpperCase()}</dt><dd className="text-[14px] break-words">{v}</dd></div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="serif text-[30px] leading-none">Guardrails</h2>
          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {guard.map(([t, d]) => <div key={t} className="border-t border-ink pt-2.5"><p className="text-[15px] font-semibold">{t}</p><p className="mt-1 text-[13.5px] leading-relaxed text-ink/72">{d}</p></div>)}
          </div>
        </section>
      </div>
      <section>
        <h2 className="serif text-[30px] leading-none">Privacy</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          {privacy.map(([t, d]) => <div key={t} className="border-t border-ink pt-3"><p className="text-[16px] font-semibold">{t}</p><p className="mt-1 text-[14px] leading-relaxed text-ink/72">{d}</p></div>)}
        </div>
      </section>
      <p className="mono text-[10.5px] tracking-[0.12em] text-ink/55">A PERSONAL PROJECT · FOR LEARNING ONLY · NOT FINANCIAL ADVICE</p>
    </div>
  );
}

export default function ResearchDemo() {
  const [tab, setTab] = useState<Tab>("board");
  const { board, offline } = useBoard();
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#F1ECE2";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);
  return (
    <div className="rp min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5"><AgentMark /><span className="hidden md:inline whitespace-nowrap text-[15px] font-semibold">RiskPulse <span className="font-normal text-ink/60">AI</span></span></a>
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ${tab === k ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/[0.06]"}`}>{l}</button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ApiMeter board={board} />
            <span className={`hidden lg:inline rounded-full px-2.5 py-1 mono text-[10px] tracking-[0.1em] ${freshness(board, offline).live ? "bg-up/15 text-up" : "bg-signal/25 text-[#7a5200]"}`}>
              {freshness(board, offline).live ? "REAL DATA · UPDATED DAILY" : freshness(board, offline).label}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6 sm:py-8">
        {tab === "board" && <RiskBoard board={board} offline={offline} />}
        {tab === "how" && <How board={board} />}
      </main>
    </div>
  );
}
