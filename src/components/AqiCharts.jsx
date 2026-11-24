// Loaded lazily so the charting library is not part of the initial bundle.
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATS, UNKNOWN_FILL, lvl } from '../lib/aqi.js';

const tick = { fill: '#94a3b8', fontSize: 11 };
const tooltipStyle = { background: '#0f2038', border: 'none' };

export function TrendChart({ data }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2dd4bf" stopOpacity=".6" />
            <stop offset="95%" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={tick} minTickGap={50} />
        <YAxis tick={tick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area dataKey="aqi" stroke="#2dd4bf" fill="url(#g)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HourlyChart({ data, best }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <XAxis dataKey="h" tick={tick} />
        <YAxis tick={tick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="aqi" isAnimationActive={false}>
          {data.map((s) => (
            <Cell
              key={s.t}
              fill={
                best.includes(s.h)
                  ? '#34d399'
                  : lvl(s.aqi) === null
                    ? UNKNOWN_FILL
                    : CATS[lvl(s.aqi)].fill
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
