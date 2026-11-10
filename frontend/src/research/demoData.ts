/** Shared types, labels and colours for the RiskPulse app. (No fake data — everything shown comes from the backend.) */

export type AssetKey = "SPY" | "BTC-USD" | "ETH-USD" | "GC=F" | "EURUSD=X";
export type Level = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const ASSET_ORDER: AssetKey[] = ["BTC-USD", "ETH-USD", "SPY", "GC=F", "EURUSD=X"];
export const ASSET_NAME: Record<AssetKey, string> = { SPY: "S&P 500", "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "GC=F": "Gold", "EURUSD=X": "EUR/USD" };

export const LEVEL: Record<Level, { color: string; bg: string; plain: string }> = {
  LOW: { color: "#0A8F5A", bg: "rgba(10,143,90,.12)", plain: "Calmer than usual" },
  MEDIUM: { color: "#9A7400", bg: "rgba(232,162,26,.18)", plain: "About normal" },
  HIGH: { color: "#D2671A", bg: "rgba(224,122,31,.15)", plain: "Rougher than usual" },
  CRITICAL: { color: "#E0412A", bg: "rgba(224,65,42,.13)", plain: "Among its roughest weeks" },
};
export const LEVELS: Level[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
/** Score bands the agent must stay inside (checked by a guardrail on the backend). */
export const BAND: Record<Level, [number, number]> = { LOW: [0, 24], MEDIUM: [25, 49], HIGH: [50, 74], CRITICAL: [75, 100] };

export type Who = "analyst" | "critic" | "judge" | "system";
export const WHO: Record<Who, { name: string; color: string }> = {
  analyst: { name: "Risk analyst agent", color: "#2F6FDE" },
  critic: { name: "Critic agent", color: "#E0412A" },
  judge: { name: "Judge agent", color: "#B07A0C" },
  system: { name: "System (guardrails)", color: "#0E0F0C" },
};
export type Line = { who: Who; text: string; tech?: string; mood?: "yes" | "no" | "warn" };

/* ── shapes returned by GET /api/board ── */
export type Reason = { claim: string; tool: string };
export type Rating = { level?: Level; score?: number; summary?: string; daily_swing_pct?: number; confidence?: "low" | "medium" | "high"; reasons?: Reason[] };
export type TraceItem =
  | { agent: "analyst" | "critic"; kind: "tool"; tool: string; args: Record<string, unknown>; result: string }
  | { agent: "analyst" | "critic"; kind: "answer"; model: string; text: string };
export type Result = {
  asset: AssetKey; name: string; rating: Rating; critic?: { verdict?: string; issue?: string; unresolved?: boolean };
  guardrail_problems?: string[]; error?: string | null; trace?: TraceItem[];
};
export type Chart = { points?: number[]; from?: string; to?: string; last_price?: number; change_1d_pct?: number | null; long_run_typical_abs_move_pct?: number; error?: string };
export type Usage = { calls?: number; tokens?: number; prompt_tokens?: number; completion_tokens?: number; by_agent?: Record<string, number>; max_calls?: number; max_tokens?: number; cost_usd?: number };
export type Board = {
  status: "starting" | "running" | "ready" | "error"; error?: string | null;
  started_at?: number | null; finished_at?: number | null; next_run_utc?: string; models: Record<string, string[]>;
  results: Result[]; charts: Record<string, Chart>; usage: Usage;
};

/** A rating is shown only if it exists, passed the guardrails and had no run error. */
export const shown = (r?: Result) => !!r?.rating?.level && !r.guardrail_problems?.length && !r.error;

const TOOL_PLAIN: Record<string, string> = {
  daily_moves: "Looking at its recent daily moves",
  compare_assets: "Comparing all 5 markets side by side",
  find_periods: "Searching history for similar moments, and what came next",
  track_record: "Reading the team's past ratings and lessons",
};

/** Turn the backend's raw trace into readable conversation lines. */
export function toLines(r: Result): Line[] {
  const out: Line[] = [];
  for (const t of r.trace ?? []) {
    if (t.kind === "tool") {
      const args = Object.entries(t.args).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ");
      out.push({ who: t.agent, text: TOOL_PLAIN[t.tool] ?? t.tool, tech: `mcp · riskpulse.${t.tool}(${args})` });
    } else {
      let parsed: any = null;
      try { parsed = JSON.parse((t.text.match(/\{[\s\S]*\}/) ?? [""])[0]); } catch { /* not JSON */ }
      if (t.agent === "analyst" && parsed?.level) {
        out.push({ who: "analyst", text: `My rating: ${parsed.level}${typeof parsed.score === "number" ? ` (${parsed.score}/100)` : ""}. ${(parsed.reasons ?? []).map((x: Reason) => x.claim).join(" · ")}`, tech: `answer from ${t.model}` });
      } else if (t.agent === "critic" && parsed?.verdict) {
        const ok = parsed.verdict === "accept";
        const issue = parsed.issue && !/^none\.?$/i.test(parsed.issue) ? " " + parsed.issue : "";
        out.push({ who: "critic", text: ok ? `I checked the evidence and accept it.${issue}` : `I want a rethink: ${parsed.issue}`, mood: ok ? "yes" : "warn", tech: `answer from ${t.model}` });
      } else if (/^\s*[{\[]/.test(t.text)) {
        out.push({ who: t.agent, text: "My answer came back cut off or badly formatted, so the guardrails asked me to send it again.", mood: "warn", tech: `answer from ${t.model}` });
      } else if (t.text) {
        out.push({ who: t.agent, text: t.text.slice(0, 220), tech: `answer from ${t.model}` });
      }
    }
  }
  if (r.critic?.unresolved) out.push({ who: "system", text: "The critic asked for a rethink, but the revised answer didn't pass our checks, so the first rating is shown. Treat this one with extra care.", mood: "warn" });
  if (r.guardrail_problems?.length) out.push({ who: "system", text: `Guardrails rejected this rating: ${r.guardrail_problems.join("; ")}`, mood: "no" });
  else if (r.rating?.level) out.push({ who: "system", text: "Guardrails passed: valid format, every reason backed by a tool, no advice.", mood: "yes" });
  if (r.error) out.push({ who: "system", text: `Run problem: ${r.error}`, mood: "no" });
  return out;
}
