export function AgentMark({ size = 22 }: { size?: number }) {
  // lead node linked to four agents
  const n = [[5, 5], [17, 5], [17, 17], [5, 17]];
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect x="0.5" y="0.5" width="21" height="21" rx="5" fill="#0E0F0C" />
      {n.map(([x, y], k) => <line key={k} x1="11" y1="11" x2={x} y2={y} stroke="#F1ECE2" strokeOpacity=".55" strokeWidth="1" />)}
      {n.map(([x, y], k) => <circle key={k} cx={x} cy={y} r="1.7" fill="#F1ECE2" />)}
      <circle cx="11" cy="11" r="3" fill="#E8A21A" />
    </svg>
  );
}
