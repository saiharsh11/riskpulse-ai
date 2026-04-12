import { useWebSocket } from "./hooks/useWebSocket";
import { AssetCard } from "./components/AssetCard";
import { AlertFeed } from "./components/AlertFeed";
import { SummaryBar } from "./components/SummaryBar";
import { Activity, Shield, Loader2 } from "lucide-react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8001/ws";

function ConnectionDot({ status }: { status: string }) {
  if (status === "connected") return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-xs text-emerald-400 font-medium">Live</span>
    </div>
  );
  if (status === "connecting") return (
    <div className="flex items-center gap-1.5">
      <Loader2 className="h-3 w-3 text-slate-500 animate-spin" />
      <span className="text-xs text-slate-500">Connecting</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      <span className="text-xs text-red-400">Disconnected</span>
    </div>
  );
}

export default function App() {
  const { data, status } = useWebSocket(WS_URL);
  const isLoading = !data || data.type === "loading";
  const snapshot = data?.type === "snapshot" ? data : null;

  return (
    <div className="min-h-screen bg-dark-900 scan-line">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.05]"
        style={{ background: "rgba(2,8,23,0.85)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10 rounded-xl p-2">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none tracking-tight">RiskPulse <span className="text-emerald-400">AI</span></h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Autonomous Market Risk Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {snapshot && (
              <span className="text-xs text-slate-600 font-mono hidden sm:block">
                {new Date(snapshot.last_updated).toLocaleTimeString()}
              </span>
            )}
            <ConnectionDot status={status} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 relative">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-32">
            <div className="glass rounded-2xl p-10 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border border-emerald-500/20 animate-ping absolute" />
                <div className="h-12 w-12 rounded-full border border-emerald-500/40 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-200">Initializing Agents</p>
                <p className="text-xs text-slate-500 mt-1">Fetching live market data...</p>
              </div>
            </div>
          </div>
        )}

        {snapshot && (
          <>
            <SummaryBar summary={snapshot.summary} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Asset Grid */}
              <section className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-emerald-400" />
                    Asset Risk Overview
                  </h2>
                  <span className="text-xs text-slate-600 font-mono">{snapshot.assets.length} assets</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {snapshot.assets.map((asset: any) => (
                    <AssetCard key={asset.ticker} asset={asset} />
                  ))}
                </div>
              </section>

              {/* Right column */}
              <section className="space-y-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-amber-400">⚡</span> Alert Feed
                </h2>
                <AlertFeed alerts={snapshot.alerts} />

                {/* Agents Panel */}
                <div className="glass rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Agents</h3>
                  {[
                    { name: "Volatility Agent", desc: "Spike detection via rolling std", color: "bg-emerald-400" },
                    { name: "Anomaly Agent",    desc: "Z-score price analysis",          color: "bg-blue-400" },
                    { name: "Risk Agent",       desc: "Weighted score aggregation",      color: "bg-amber-400" },
                    { name: "Alert Agent",      desc: "LLM incident report generation",  color: "bg-purple-400" },
                  ].map(agent => (
                    <div key={agent.name} className="flex items-start gap-3 group">
                      <div className={`h-1.5 w-1.5 rounded-full ${agent.color} mt-1.5 shrink-0 group-hover:shadow-lg transition-shadow`} />
                      <div>
                        <p className="text-xs font-semibold text-slate-300">{agent.name}</p>
                        <p className="text-xs text-slate-600">{agent.desc}</p>
                      </div>
                      <span className="ml-auto text-[10px] text-emerald-500 font-mono">● running</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/[0.04] mt-16">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-slate-600">RiskPulse AI — Multi-Agent Risk Monitor</span>
          <span className="text-xs text-slate-700 font-mono">Powered by Nvidia Nemotron + Yahoo Finance</span>
        </div>
      </footer>
    </div>
  );
}
