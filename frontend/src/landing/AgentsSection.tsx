import { useScrollProgress } from "./hooks";

/**
 * Pinned scroll story: a real exchange between the agents (Ethereum, from an actual run).
 * Kept short: four steps over ~2.6 screens of scrolling.
 */

const STEPS = [
  { k: "01", title: "The analyst gathers evidence", body: "It decides which tools to use and what to look up. Here it checks Ethereum's last seven days of moves." },
  { k: "02", title: "It makes a call", body: "Based on what it found, it rates the coming week and explains why, with numbers for every reason." },
  { k: "03", title: "A second agent checks it", body: "The Critic runs on a different model, so it doesn't share the same blind spots. It looks at the data itself and pushes back." },
  { k: "04", title: "They settle on an answer", body: "The analyst takes another look and adjusts. The final rating only goes out once every reason is backed by real data." },
];

const LOG = [
  { t: 0, who: "Analyst", model: "gpt-oss-120b", text: "Looking up Ethereum's last 7 days of moves.", tech: "mcp · daily_moves(asset=ETH-USD, days=7)" },
  { t: 1, who: "Analyst", model: "gpt-oss-120b", text: "Average move is 3.27% a day, about 63% above its usual 2.0%. Two days moved more than 5%. My rating: HIGH." },
  { t: 2, who: "Critic", model: "Qwen 3.8", text: "I checked the same data. I think this overreacts to two big days. The typical day was 2.83%, closer to normal.", tech: "mcp · daily_moves(asset=ETH-USD, days=7)", warn: true },
  { t: 3, who: "Analyst", model: "gpt-oss-120b", text: "Fair point. The average is skewed by those two days. Revising to MEDIUM.", ok: true },
  { t: 3, who: "Guardrails", model: "", text: "Every reason is backed by a tool result, and there's no buy or sell advice. Published.", ok: true },
];

export function AgentsSection() {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const stage = Math.min(3, Math.floor(p * 4.4));
  const nodes = [
    { x: 90, y: 150, label: "Tools", sub: "MCP · 3 tools", on: stage === 0 || stage === 2 },
    { x: 290, y: 70, label: "Analyst", sub: "gpt-oss-120b · Groq", on: stage === 0 || stage === 1 || stage === 3 },
    { x: 490, y: 150, label: "Critic", sub: "Qwen 3.8 · Groq", on: stage === 2 },
  ];
  const edge = (a: number, b: number, active: boolean) => {
    const d = `M${nodes[a].x},${nodes[a].y} L${nodes[b].x},${nodes[b].y}`;
    return (
      <g key={`${a}${b}`}>
        <path d={d} stroke="#F1ECE2" strokeOpacity={active ? 0.85 : 0.15} strokeDasharray={active ? "5 6" : undefined} className={active ? "rp-flow" : undefined} fill="none" />
        {active && <circle r="4" fill="#E8A21A"><animateMotion dur="1.2s" repeatCount="indefinite" path={d} /></circle>}
      </g>
    );
  };

  return (
    <section ref={ref} id="agents" className="relative bg-ink text-paper" style={{ height: "260vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-6 px-4 pt-20 pb-8 sm:px-8 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:pt-24">
          <div className="lg:col-span-5 flex flex-col">
            <p className="mono text-[10.5px] tracking-[0.18em] text-paper/60">MEET THE AGENTS</p>
            <h2 className="serif mt-3 text-[38px] leading-[0.95] sm:text-[60px]">Two minds,<br /><em className="text-paper/60">one careful answer.</em></h2>
            <ol className="mt-6 lg:mt-auto space-y-1 border-t border-paper/15 pt-4">
              {STEPS.map((s, i) => (
                <li key={s.k} className="grid grid-cols-[36px_1fr] gap-x-3 py-1.5">
                  <span className={`mono text-[11px] tracking-[0.14em] pt-1 transition-colors ${i === stage ? "text-signal" : "text-paper/35"}`}>{s.k}</span>
                  <div>
                    <p className={`text-[17px] font-medium transition-colors duration-300 ${i === stage ? "text-paper" : "text-paper/40"}`}>{s.title}</p>
                    <p className={`overflow-hidden text-[14px] leading-relaxed text-paper/75 transition-all duration-500 ${i === stage ? "mt-1 max-h-24 opacity-100" : "max-h-0 opacity-0"}`}>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:col-span-7 flex min-h-0 flex-1 flex-col">
            <svg viewBox="0 0 580 220" className="w-full max-h-[24vh] lg:max-h-[34vh] shrink-0" role="img" aria-label="Analyst, Critic and tools">
              {edge(1, 0, stage === 0)}
              {edge(2, 0, stage === 2)}
              {edge(1, 2, stage === 1 || stage === 3)}
              {nodes.map((n) => (
                <g key={n.label} style={{ transition: "opacity .4s" }} opacity={n.on ? 1 : 0.5}>
                  <circle cx={n.x} cy={n.y} r="34" fill={n.on ? "#F1ECE2" : "#0E0F0C"} stroke="#F1ECE2" strokeOpacity=".6" />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12" className="mono" fill={n.on ? "#0E0F0C" : "#F1ECE2"}>{n.label}</text>
                  <text x={n.x} y={n.y + 52} textAnchor="middle" fontSize="10" className="mono" fill="#F1ECE2" fillOpacity=".55">{n.sub}</text>
                </g>
              ))}
            </svg>
            <div className="mt-3 flex-1 min-h-0 border-t border-paper/15 pt-4">
              <div className="flex items-center justify-between">
                <p className="mono text-[10px] tracking-[0.16em] text-paper/50">A REAL EXCHANGE · ETHEREUM</p>
                <p className="mono text-[10px] tracking-[0.16em] text-paper/50">FROM AN ACTUAL RUN</p>
              </div>
              <ol className="mt-3 space-y-2.5 overflow-hidden">
                {LOG.filter((l) => l.t <= stage).map((l, i) => (
                  <li key={i} className="rp-fadein grid grid-cols-[96px_1fr] gap-3 text-[13.5px] leading-snug sm:text-[14.5px]">
                    <span className="pt-0.5">
                      <span className={`block text-[12px] font-semibold ${l.who === "Critic" ? "text-[#FF8A73]" : l.who === "Guardrails" ? "text-[#6FD3A4]" : "text-[#8FB4FF]"}`}>{l.who}</span>
                      {l.model && <span className="block mono text-[10px] text-paper/45">{l.model}</span>}
                    </span>
                    <span>
                      <span className={l.warn ? "text-[#FFC9A8]" : l.ok ? "text-[#B9F0D6]" : "text-paper/90"}>{l.text}</span>
                      {l.tech && <span className="mt-0.5 block mono text-[10.5px] text-paper/40">{l.tech}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
