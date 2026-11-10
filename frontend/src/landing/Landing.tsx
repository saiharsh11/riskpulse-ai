import { useCallback, useEffect, useState } from "react";
import { ParticleField } from "./ParticleField";
import { AgentsSection } from "./AgentsSection";
import { PhoneSection } from "./PhoneSection";
import { useInView } from "./hooks";
import { AgentMark } from "./Mark";
import { ASSET_NAME, ASSET_ORDER, LEVEL, LEVELS, type Board, type Level, shown } from "../research/demoData";
import { freshness, useBoard, whoRated } from "../research/useBoard";
import "./landing.css";

/* ───────────────────────── Nav ───────────────────────── */
function Nav({ board }: { board: Board | null }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const fresh = freshness(board);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "bg-paper border-b border-ink/10" : ""}`}>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-8">
        <a href="/" className="flex items-center gap-2.5 text-ink">
          <AgentMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">RiskPulse <span className="font-normal text-ink/65">AI</span></span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-ink/80">
          <a href="#levels" className="rp-link">How it works</a>
          <a href="#agents" className="rp-link">The agents</a>
          <a href="#models" className="rp-link">Models</a>
          <a href="#today" className="rp-link">Today</a>
        </nav>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-2 mono text-[10.5px] tracking-[0.14em] text-ink/72">
            <span className={`h-1.5 w-1.5 rounded-full ${fresh.live ? "bg-up rp-blink" : "bg-ink/30"}`} />
            {fresh.label}
          </span>
          <a href="/dashboard" className="rp-btn-ink">See today's ratings</a>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[640px] overflow-hidden bg-paper cursor-crosshair select-none">
      <ParticleField />
      <div data-hero-text className="pointer-events-none relative z-10 mx-auto max-w-[1400px] px-4 pt-28 sm:px-8 sm:pt-32">
        <p className="mono text-[10.5px] tracking-[0.18em] text-ink/70 rp-in" style={{ animationDelay: ".2s" }}>AI AGENTS · STOCKS, CRYPTO, GOLD &amp; FX · REAL MARKET DATA</p>
        <h1 className="serif mt-5 text-[50px] leading-[0.92] tracking-[-0.02em] text-ink sm:text-[90px] lg:text-[118px]">
          <span className="rp-line"><span style={{ animationDelay: ".35s" }}>A calm, clear look</span></span>
          <span className="rp-line"><span style={{ animationDelay: ".5s" }}>at the <em className="text-up">markets.</em></span></span>
        </h1>
        <div className="mt-6 flex flex-col gap-6">
          <p className="max-w-[540px] text-[16px] leading-relaxed text-ink/85 sm:text-[18px] rp-in" style={{ animationDelay: ".9s" }}>
            RiskPulse AI is a friendly little team of AI agents that keeps an eye on the <b className="font-semibold text-ink">financial markets</b>. Every day they study the S&amp;P 500, Bitcoin, Ethereum, gold and the euro, give each one a simple risk rating for the week ahead, and show you exactly how they got there.
          </p>
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rp-in" style={{ animationDelay: "1.1s" }}>
            <a href="/dashboard" className="rp-btn-ink">See today's ratings <span aria-hidden>→</span></a>
            <a href="#agents" className="rp-btn-ghost">Meet the agents</a>
          </div>
        </div>
      </div>
      <p className="pointer-events-none absolute bottom-[86px] right-4 hidden sm:right-8 sm:block mono text-[10px] tracking-[0.16em] text-ink/55 rp-in" style={{ animationDelay: "2.6s" }}>
        TRY MOVING YOUR CURSOR THROUGH THE CHART
      </p>
    </section>
  );
}

/* ───────────────────────── Ticker tape (latest real ratings) ───────────────────────── */
function Tape({ board }: { board: Board | null }) {
  const items = ASSET_ORDER.map((k) => {
    const r = board?.results?.find((x) => x.asset === k);
    return { name: ASSET_NAME[k], level: (shown(r) ? r?.rating?.level : undefined) as Level | undefined, swing: r?.rating?.daily_swing_pct };
  });
  const row = [...items, ...items, ...items];
  return (
    <div className="relative overflow-hidden bg-ink text-paper">
      <div className="absolute inset-y-0 left-0 z-10 flex items-center bg-ink pl-4 pr-5 sm:pl-8 mono text-[10px] tracking-[0.16em] text-signal shadow-[16px_0_16px_-4px_#0E0F0C]">TODAY'S RATINGS</div>
      <div className="rp-marquee flex w-max">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0">
            {row.map((a, i) => (
              <div key={`${k}-${i}`} className="flex items-center gap-3 border-r border-paper/10 px-6 py-4">
                <span className="text-[13px] text-paper/80">{a.name}</span>
                <span className="mono text-[11px] tracking-[0.1em]" style={{ color: a.level ? LEVEL[a.level].color : "#9A988F", filter: "brightness(1.6)" }}>{a.level ?? "…"}</span>
                {a.swing != null && <span className="mono text-[11px] text-paper/50">±{a.swing}%/day</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Four simple levels ───────────────────────── */
const LEVEL_TEXT: Record<Level, string> = {
  LOW: "Quieter than usual for this market. A calm week is likely.",
  MEDIUM: "About normal. Nothing unusual is going on.",
  HIGH: "Bumpier than usual. Expect bigger moves than normal.",
  CRITICAL: "One of its roughest stretches. Things are moving a lot.",
};
function Levels() {
  const [ref, seen] = useInView<HTMLDivElement>(0.25);
  return (
    <section id="levels" className="bg-paper">
      <div ref={ref} className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8 sm:py-32">
        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 lg:col-span-7">
            <p className="mono text-[10.5px] tracking-[0.18em] text-ink/65">HOW IT WORKS</p>
            <h2 className="serif mt-4 text-[44px] leading-[0.95] tracking-[-0.01em] sm:text-[72px]">Four simple levels,<br /><em className="text-ink/55">no jargon needed.</em></h2>
          </div>
          <p className="col-span-12 text-[15.5px] leading-relaxed text-ink/75 lg:col-span-5 lg:pb-3">
            Each market is compared with its own normal. A 2% day is huge for gold but ordinary for Bitcoin, so the agents always ask: is this week rougher or calmer than usual for <em>this</em> market?
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LEVELS.map((l, i) => (
            <div key={l} className="border border-ink/12 bg-white/50 p-5 transition-all duration-700"
              style={{ opacity: seen ? 1 : 0, transform: seen ? "none" : "translateY(16px)", transitionDelay: `${i * 120}ms` }}>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold" style={{ color: LEVEL[l].color, background: LEVEL[l].bg }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL[l].color }} />{l}
              </span>
              <div className="mt-5 h-2 overflow-hidden bg-ink/[0.07]">
                <div className="h-full origin-left" style={{ width: `${25 * (i + 1)}%`, background: LEVEL[l].color, transform: seen ? "scaleX(1)" : "scaleX(0)", transition: "transform 1s cubic-bezier(.16,1,.3,1)", transitionDelay: `${300 + i * 150}ms` }} />
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/80">{LEVEL_TEXT[l]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Models and providers ───────────────────────── */
const MODELS = [
  { role: "Risk analyst", model: "gpt-oss-120b", maker: "OpenAI (open-weight)", provider: "Groq", why: "Does the investigating, so it gets the model that's best at using tools." },
  { role: "Critic", model: "Qwen 3.8", maker: "Alibaba (open-weight)", provider: "Groq", why: "A different model family on purpose, so its second opinion is truly independent." },
  { role: "Backups", model: "Gemma 4 · Nemotron", maker: "Google · NVIDIA (open-weight)", provider: "OpenRouter", why: "If a model is busy, the next one steps in, so the ratings still go out." },
];
function Models() {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  return (
    <section id="models" className="bg-forest text-paper">
      <div ref={ref} className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8 sm:py-32">
        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 lg:col-span-7">
            <p className="mono text-[10.5px] tracking-[0.18em] text-paper/65">UNDER THE HOOD</p>
            <h2 className="serif mt-4 text-[44px] leading-[0.95] sm:text-[72px]">Built on open models,<br /><em className="text-signal">one for each job.</em></h2>
          </div>
          <p className="col-span-12 text-[15.5px] leading-relaxed text-paper/80 lg:col-span-5 lg:pb-3">
            Each agent runs on its own open-weight model, served by Groq and OpenRouter. The agents reach market data through small read-only tools over MCP, the open standard for connecting AI to tools.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {MODELS.map((m, i) => (
            <div key={m.role} className="border border-paper/20 bg-paper/[0.04] p-6 transition-all duration-700"
              style={{ opacity: seen ? 1 : 0, transform: seen ? "none" : "translateY(16px)", transitionDelay: `${i * 140}ms` }}>
              <p className="mono text-[10.5px] tracking-[0.16em] text-signal">{m.role.toUpperCase()}</p>
              <p className="serif mt-3 text-[32px] leading-none">{m.model}</p>
              <p className="mt-2 text-[13.5px] text-paper/70">{m.maker}</p>
              <p className="mt-1 mono text-[11px] text-paper/55">via {m.provider}</p>
              <p className="mt-4 border-t border-paper/15 pt-4 text-[14px] leading-relaxed text-paper/80">{m.why}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-paper/15 pt-6">
          <span className="mono text-[10.5px] tracking-[0.16em] text-paper/55">PROVIDERS</span>
          {["Groq", "OpenRouter"].map((p) => <span key={p} className="text-[20px] font-semibold">{p}</span>)}
          <span className="mono text-[10.5px] tracking-[0.16em] text-paper/55 sm:ml-6">TOOLS</span>
          {["daily_moves", "compare_assets", "find_periods"].map((t) => <span key={t} className="rounded-md border border-paper/20 px-2.5 py-1 mono text-[12px] text-paper/85">{t}</span>)}
          <span className="rounded-md border border-dashed border-paper/20 px-2.5 py-1 mono text-[12px] text-paper/45">track_record · coming soon</span>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Today (live board) ───────────────────────── */
function Today({ board }: { board: Board | null }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  const ready = board?.status === "ready";
  return (
    <section id="today" className="bg-paper">
      <div ref={ref} className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8 sm:py-32">
        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 lg:col-span-7">
            <p className="mono text-[10.5px] tracking-[0.18em] text-ink/65">TODAY</p>
            <h2 className="serif mt-4 text-[44px] leading-[0.95] tracking-[-0.01em] sm:text-[72px]">Here's how things<br /><em className="text-ink/55">look right now.</em></h2>
          </div>
          <p className="col-span-12 text-[15px] leading-relaxed text-ink/75 lg:col-span-5 lg:pb-3">
            These are the agents' latest ratings, made from real market prices.
            <span className="mt-3 block mono text-[10.5px] tracking-[0.14em] text-ink/60">
              {ready && board?.finished_at ? `UPDATED ${new Date(board.finished_at * 1000).toLocaleString()}` : "THE AGENTS ARE STILL WORKING ON TODAY'S RATINGS"}
            </span>
          </p>
        </div>
        <div className="mt-12 border-t border-ink">
          {ASSET_ORDER.map((k, i) => {
            const r = board?.results?.find((x) => x.asset === k);
            const lvl = (shown(r) ? r?.rating?.level : undefined) as Level | undefined;
            const who = whoRated(r);
            return (
              <div key={k} className={`rp-row grid grid-cols-2 gap-x-6 gap-y-2 border-b border-ink/15 py-5 md:grid-cols-[1.6fr_0.7fr_0.6fr_2.4fr] ${seen ? "rp-row-in" : ""}`} style={{ transitionDelay: `${i * 90}ms` }}>
                <div><p className="text-[18px] font-medium">{ASSET_NAME[k]}</p><p className="mono text-[10.5px] text-ink/55">{who.rated ? `rated by ${who.rated} · checked by ${who.checked}` : k}</p></div>
                <div className="self-center">{lvl ? <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold" style={{ color: LEVEL[lvl].color, background: LEVEL[lvl].bg }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL[lvl].color }} />{lvl}</span> : <span className="text-ink/50">…</span>}</div>
                <p className="self-center mono text-[15px]">{r?.rating?.daily_swing_pct != null ? `±${r.rating.daily_swing_pct}%` : ""}</p>
                <p className="col-span-2 self-center text-[14px] leading-snug text-ink/75 md:col-span-1">{r?.rating?.reasons?.[0]?.claim ?? ""}</p>
              </div>
            );
          })}
        </div>
        <a href="/dashboard" className="rp-btn-ghost mt-8">See the full reasoning for each market <span aria-hidden>→</span></a>
      </div>
    </section>
  );
}

/* ───────────────────────── Closing ───────────────────────── */
function Closing() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  return (
    <section className="relative overflow-hidden bg-paper">
      <div ref={ref} className={`mx-auto max-w-[1400px] px-4 pt-10 pb-20 transition-opacity duration-1000 sm:px-8 ${seen ? "opacity-100" : "opacity-0"}`}>
        <h2 className="serif mt-10 text-[52px] leading-[0.92] tracking-[-0.02em] sm:text-[96px] lg:text-[124px]">
          Thanks for stopping by.<br /><em className="text-up">Have a look around.</em>
        </h2>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a href="/dashboard" className="rp-btn-ink rp-btn-lg">See today's ratings <span aria-hidden>→</span></a>
          <span className="mono text-[10.5px] tracking-[0.14em] text-ink/60">FREE TO USE · NO SIGN-UP</span>
        </div>
      </div>
      <footer className="border-t border-ink/15">
        <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-3 px-4 py-6 mono text-[10.5px] tracking-[0.12em] text-ink/60 sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} RISKPULSE AI · A PERSONAL PROJECT</span>
          <span>FOR LEARNING ONLY · NOT FINANCIAL ADVICE · PRICES FROM YAHOO FINANCE</span>
        </div>
      </footer>
    </section>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export default function Landing() {
  const { board } = useBoard(120_000);
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#F1ECE2";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);
  return (
    <div className="rp bg-paper text-ink">
      <Nav board={board} />
      <Hero />
      <Tape board={board} />
      <Levels />
      <AgentsSection />
      <PhoneSection board={board} />
      <Models />
      <Today board={board} />
      <Closing />
    </div>
  );
}
