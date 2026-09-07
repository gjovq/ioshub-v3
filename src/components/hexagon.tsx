type RadarAxis = { label: string; value: number | null };

/** Missing observations are gaps, not zeroes. Only complete profiles are filled. */
export function HexagonChart({
  axes,
  color = '#22c55e',
  size = 260,
  compare,
  compareColor = '#38bdf8',
  label = 'Player profile radar',
}: {
  /** Normalized values from 0 to 1; null means unavailable. */
  axes: RadarAxis[];
  color?: string;
  size?: number;
  compare?: RadarAxis[];
  compareColor?: string;
  label?: string;
}) {
  const n = Math.max(3, axes.length);
  const cx = 210;
  const cy = 155;
  const radius = 86;
  const valid = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const point = (i: number, value: number, extra = 0) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = radius * Math.max(0, Math.min(1, value)) + extra;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };
  const ring = (value: number) => axes.map((_, i) => point(i, value).join(',')).join(' ');
  const profile = (values: RadarAxis[], tone: string, comparison = false) => {
    const complete = values.length === axes.length && values.length >= 3 && values.every((a) => valid(a.value));
    return (
      <g>
        {complete && (
          <polygon
            points={values.map((a, i) => point(i, a.value!).join(',')).join(' ')}
            fill={tone} fillOpacity={comparison ? 0.10 : 0.20}
            stroke={tone} strokeWidth="2" strokeDasharray={comparison ? '4 3' : undefined}
          />
        )}
        {axes.map((_, i) => {
          const value = values[i]?.value;
          if (!valid(value)) return null;
          const [x, y] = point(i, value);
          const next = values[(i + 1) % axes.length]?.value;
          const [nx, ny] = valid(next) ? point((i + 1) % axes.length, next) : [x, y];
          return (
            <g key={i}>
              {!complete && valid(next) && <line x1={x} y1={y} x2={nx} y2={ny} stroke={tone} strokeWidth="2" strokeDasharray={comparison ? '4 3' : undefined} />}
              <circle cx={x} cy={y} r="3" fill={tone} />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 420 310" width={size} className="h-auto w-full" role="img"
      aria-label={`${label}. ${axes.map((a) => `${a.label}: ${valid(a.value) ? `${Math.round(Math.max(0, Math.min(1, a.value)) * 100)} of 100` : 'unavailable'}`).join('; ')}. Missing values are gaps, not zero.`}>
      {[0.25, 0.5, 0.75, 1].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="rgba(148,163,184,0.2)" />)}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(148,163,184,0.15)" />;
      })}
      {compare && profile(compare, compareColor, true)}
      {profile(axes, color)}
      {axes.map((axis, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const [x, y] = point(i, 1, 17);
        const anchor = Math.abs(Math.cos(angle)) < 0.3 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
        // Wrap even long unbroken labels within the generous side gutters.
        const words = axis.label.match(/.{1,16}(?:\s|$)|\S{1,16}/g) ?? [axis.label];
        const lines = [...words.map((word) => word.trim()), ...(!valid(axis.value) ? ['Unavailable'] : [])];
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} fontSize="10" fontWeight="600" fill="rgba(203,213,225,0.9)">
            {lines.map((line, j) => <tspan key={j} x={x} dy={j === 0 ? -(lines.length - 1) * 6 : 12}>{line}</tspan>)}
          </text>
        );
      })}
    </svg>
  );
}
