import clsx from "clsx";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap } from "lucide-react";
import { Badge } from "./Badge";
import { RiskMeter } from "./RiskMeter";

function formatPrice(price: number, ticker: string) {
  if (ticker === "EURUSD=X") return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const glowClass: Record<string, string> = {
  CRITICAL: "glow-red border-red-500/25 glow-red-hover",
  HIGH:     "glow-orange border-orange-500/20 glow-orange-hover",
  MEDIUM:   "glow-yellow border-amber-500/15 glow-yellow-hover",
  LOW:      "glow-green border-emerald-500/10 glow-green-hover",
};

export function AssetCard({ asset }: { asset: any }) {
  const { ticker, name, price, risk, volatility, anomaly, alert } = asset;
  const direction = anomaly?.direction;
  const isCritical = risk.level === "CRITICAL";

  return (
    <div className={clsx(
      "glass glass-hover rounded-2xl p-5 flex flex-col gap-4 cursor-default animate-fade-in",
      glowClass[risk.level] || "border-slate-700/30"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">{ticker}</span>
            {isCritical && <Zap className="h-3 w-3 text-red-400 animate-pulse" />}
          </div>
          <h3 className="text-sm font-semibold text-slate-100 mt-0.5">{name}</h3>
        </div>
        <Badge level={risk.level} pulse={isCritical} />
      </div>

      {/* Price + Meter */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-mono font-bold text-white tracking-tight">
            {formatPrice(price, ticker)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {direction === "upward"
              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              : direction === "downward"
              ? <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              : <Minus className="h-3.5 w-3.5 text-slate-500" />}
            <span className={clsx("text-xs font-mono font-medium",
              direction === "upward" ? "text-emerald-400" :
              direction === "downward" ? "text-red-400" : "text-slate-500")}>
              {anomaly?.last_return_pct != null
                ? `${anomaly.last_return_pct > 0 ? "+" : ""}${anomaly.last_return_pct}%`
                : "—"}
            </span>
          </div>
        </div>
        <RiskMeter score={risk.score} size="md" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Volatility", value: `${volatility.current_vol ?? 0}%` },
          { label: "Vol Ratio",  value: `${volatility.ratio ?? 0}x`, highlight: volatility.spike },
          { label: "Z-Score",   value: String(anomaly.z_score ?? 0), highlight: anomaly.anomaly },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">{s.label}</div>
            <div className={clsx("text-sm font-mono font-semibold",
              s.highlight ? "text-orange-400" : "text-slate-300")}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {alert?.generated && (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3 flex gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{alert.message}</p>
        </div>
      )}
    </div>
  );
}
