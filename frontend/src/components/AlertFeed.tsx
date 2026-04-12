import { AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { Badge } from "./Badge";
import { formatDistanceToNow } from "date-fns";

export function AlertFeed({ alerts }: { alerts: any[] }) {
  if (alerts.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3 min-h-[180px]">
        <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-300">All Clear</p>
          <p className="text-xs text-slate-500 mt-1">No active risk alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">Active Alerts</span>
        </div>
        <span className="text-xs font-mono text-slate-500">{alerts.length} triggered</span>
      </div>
      <div className="divide-y divide-white/[0.04] max-h-[480px] overflow-y-auto">
        {alerts.map((alert, i) => (
          <div key={i} className="px-5 py-4 hover:bg-white/[0.02] transition-colors animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-slate-400">{alert.ticker}</span>
              <Badge level={alert.level} pulse={alert.level === "CRITICAL"} />
              <span className="ml-auto text-xs font-mono text-slate-600">{alert.score}/100</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{alert.message}</p>
            <div className="flex items-center gap-1 mt-2">
              <Clock className="h-3 w-3 text-slate-600" />
              <span className="text-xs text-slate-600">
                {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
