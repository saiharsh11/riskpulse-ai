import { ShieldAlert, TrendingUp, Activity, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

const stats = [
  { key: "critical", label: "Critical", icon: ShieldAlert, color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    glow: "glow-red" },
  { key: "high",     label: "High",     icon: TrendingUp,  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", glow: "glow-orange" },
  { key: "medium",   label: "Medium",   icon: Activity,    color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20",  glow: "glow-yellow" },
  { key: "low",      label: "Low",      icon: CheckCircle2,color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20", glow: "glow-green" },
];

export function SummaryBar({ summary }: { summary: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ key, label, icon: Icon, color, bg, glow }) => (
        <div key={key} className={clsx("glass glass-hover rounded-2xl p-4 flex items-center gap-3", glow)}>
          <div className={clsx("rounded-xl p-2 border", bg)}>
            <Icon className={clsx("h-4 w-4", color)} />
          </div>
          <div>
            <div className={clsx("text-2xl font-mono font-bold", color)}>{(summary as any)[key]}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
