interface RiskMeterProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getColor(score: number) {
  if (score >= 55) return { stroke: "#f87171", text: "#f87171", glow: "rgba(239,68,68,0.5)" };
  if (score >= 35) return { stroke: "#fb923c", text: "#fb923c", glow: "rgba(249,115,22,0.5)" };
  if (score >= 15) return { stroke: "#fbbf24", text: "#fbbf24", glow: "rgba(245,158,11,0.5)" };
  return { stroke: "#34d399", text: "#34d399", glow: "rgba(16,185,129,0.4)" };
}

export function RiskMeter({ score, size = "md" }: RiskMeterProps) {
  const dimensions = { sm: 60, md: 84, lg: 108 };
  const dim = dimensions[size];
  const strokeWidth = size === "sm" ? 5 : 6;
  const radius = (dim - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const { stroke, text, glow } = getColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim/2} cy={dim/2} r={radius} fill="none"
          stroke="rgba(148,163,184,0.08)" strokeWidth={strokeWidth} />
        <circle cx={dim/2} cy={dim/2} r={radius} fill="none"
          stroke={stroke} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${glow})`, transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="absolute font-mono font-bold"
        style={{ color: text, fontSize: size === "sm" ? 12 : size === "md" ? 17 : 22,
          textShadow: `0 0 12px ${glow}` }}>
        {score}
      </span>
    </div>
  );
}
