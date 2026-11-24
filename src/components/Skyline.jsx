const BUILDINGS = [
  [20, 50, 30],
  [55, 30, 28],
  [90, 60, 25],
  [120, 20, 30],
  [155, 45, 28],
  [190, 35, 26],
  [222, 55, 30],
  [258, 25, 28],
  [292, 48, 26],
  [325, 38, 30],
  [360, 58, 24],
];

export default function Skyline() {
  return (
    <svg
      viewBox="0 0 400 110"
      className="mx-auto mb-4 w-full max-w-md"
      role="img"
      aria-label="City skyline under smog, with clean air above"
    >
      <defs>
        <linearGradient id="sm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2dd4bf" stopOpacity=".05" />
          <stop offset="1" stopColor="#f97316" stopOpacity=".55" />
        </linearGradient>
      </defs>
      <rect width="400" height="110" fill="url(#sm)" rx="16" />
      <g fill="#16304f">
        {BUILDINGS.map(([x, y, w]) => (
          <rect key={x} x={x} y={y + 20} width={w} height={90 - y - 20} />
        ))}
      </g>
      <g fill="#fff" opacity=".12" className="animate-[float_6s_ease-in-out_infinite]">
        <ellipse cx="90" cy="60" rx="70" ry="12" />
        <ellipse cx="260" cy="72" rx="90" ry="14" />
      </g>
      <g fill="#34d399">
        <circle cx="340" cy="22" r="10" className="animate-[float_4s_ease-in-out_infinite]" />
        <path d="M336 22q4-8 8 0q-4 8-8 0z" fill="#0a1628" />
      </g>
    </svg>
  );
}
