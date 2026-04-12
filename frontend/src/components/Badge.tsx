import clsx from "clsx";

type BadgeVariant = "low" | "medium" | "high" | "critical" | "neutral";

const styles: Record<BadgeVariant, string> = {
  low:      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  medium:   "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  high:     "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border border-red-500/30",
  neutral:  "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

const dots: Record<BadgeVariant, string> = {
  low:      "bg-emerald-400",
  medium:   "bg-amber-400",
  high:     "bg-orange-400",
  critical: "bg-red-400",
  neutral:  "bg-slate-400",
};

export function Badge({ level, pulse = false }: { level: string; pulse?: boolean }) {
  const key = level.toLowerCase() as BadgeVariant;
  const variant = key in styles ? key : "neutral";
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide", styles[variant])}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", dots[variant], pulse && variant === "critical" && "animate-pulse")} />
      {level}
    </span>
  );
}
