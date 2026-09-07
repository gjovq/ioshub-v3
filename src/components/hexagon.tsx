/**
 * Hexagon radar chart for player scouting. Six axes, each normalised 0..1;
 * the filled shape shows a player's profile at a glance (attacker wide at the
 * top, keeper wide at the bottom, etc.).
 */
export function HexagonChart({
  axes,
  color = '#22c55e',
  size = 260,
  compare,
  compareColor = '#38bdf8',
}: {
  /** value: 0..1 per axis */
  axes: { label: string; value: number }[];
  color?: string;
  size?: number;
  /** optional second profile overlaid for comparison */
  compare?: { label: string; value: number }[];
  compareColor?: string;
}) {
  const n = Math.max(3, axes.length);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34; // room for labels

  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2; // start at top
    const t = Math.max(0, Math.min(1, v));
    return [cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t];
  };

  const ring = (f: number) =>
    axes.map((_, i) => point(i, f).map((c) => c.toFixed(1)).join(',')).join(' ');

  const shape = (vals: { value: number }[]) =>
    vals.map((ax, i) => point(i, ax.value).map((c) => c.toFixed(1)).join(',')).join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full"
      role="img"
      aria-label="Player profile radar"
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="1"
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(148,163,184,0.1)"
            strokeWidth="1"
          />
        );
      })}
      {compare && (
        <polygon
          points={shape(compare)}
          fill={compareColor}
          fillOpacity="0.12"
          stroke={compareColor}
          strokeWidth="1.4"
          strokeDasharray="4 3"
        />
      )}
      <polygon
        points={shape(axes)}
        fill={color}
        fillOpacity="0.22"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {axes.map((ax, i) => {
        const [x, y] = point(i, ax.value);
        return <circle key={i} cx={x} cy={y} r="2.6" fill={color} />;
      })}
      {axes.map((ax, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const lx = cx + Math.cos(a) * (r + 18);
        const ly = cy + Math.sin(a) * (r + 18);
        const anchor =
          Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="10"
            fontWeight="600"
            fill="rgba(148,163,184,0.85)"
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}
