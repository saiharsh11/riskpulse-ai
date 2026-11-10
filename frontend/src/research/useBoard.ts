import { useEffect, useState } from "react";
import type { Board, Result } from "./demoData";

// The site only ever talks to the public API. A local preview can point elsewhere via VITE_API_URL in .env.local.
const PUBLIC_API = "https://riskpulse-ai-production.up.railway.app";
export const API = (import.meta.env.VITE_API_URL || PUBLIC_API).replace(/\/+$/, "");

/** Latest board from the backend. Results load instantly; the page re-checks quietly in the background. */
export function useBoard(pollMs = 60_000) {
  const [board, setBoard] = useState<Board | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const b: Board = await (await fetch(`${API}/api/board`, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" })).json();
        if (!alive) return;
        setBoard(b); setOffline(false);
        timer = setTimeout(load, b.status === "ready" ? pollMs : 5_000);
      } catch {
        if (!alive) return;
        setOffline(true);
        timer = setTimeout(load, 5_000);
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [pollMs]);
  return { board, offline };
}

/** Friendly model names, e.g. "groq/openai/gpt-oss-120b" → "gpt-oss-120b". */
export function shortModel(id?: string) {
  if (!id) return "";
  const last = id.split("/").pop() ?? id;
  return last.replace(":free", "").replace(/-it$/, "").replace("qwen3.8-27b", "Qwen 3.8").replace(/^gemma-4-31b$/, "Gemma 4").replace(/^nemotron.*$/, "Nemotron");
}

/** Which model rated a market and which one checked it, from the run trace. */
export function whoRated(r?: Result) {
  const answers = (r?.trace ?? []).filter((t) => t.kind === "answer") as { agent: string; model: string }[];
  const rated = answers.filter((a) => a.agent === "analyst").pop()?.model;
  const checked = answers.filter((a) => a.agent === "critic").pop()?.model;
  return { rated: shortModel(rated), checked: shortModel(checked) };
}

/** "Rated by X · checked by Y", or a plain note when no critic ran. */
export function byline(r?: Result) {
  const w = whoRated(r);
  return `Rated by ${w.rated || "an AI agent"}${w.checked ? ` · checked by ${w.checked}` : " · not double-checked this time"}`;
}

/** Honest freshness label for the header: only "today" if a rating actually finished in the last 24 hours. */
export function freshness(board: Board | null, offline = false): { label: string; live: boolean } {
  if (offline) return { label: "OFFLINE", live: false };
  if (!board || board.status === "starting" || board.status === "running") return { label: "UPDATING", live: false };
  const rated = (board.results ?? []).some((r) => r.rating?.level && !r.guardrail_problems?.length && !r.error);
  if (!rated || !board.finished_at) return { label: "UPDATE PENDING", live: false };
  const hours = (Date.now() / 1000 - board.finished_at) / 3600;
  if (hours < 24) return { label: "UPDATED TODAY", live: true };
  return { label: `UPDATED ${new Date(board.finished_at * 1000).toLocaleDateString([], { month: "short", day: "numeric" }).toUpperCase()}`, live: false };
}
