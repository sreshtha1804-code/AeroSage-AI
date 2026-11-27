// Loaded lazily so the charting library is not part of the initial bundle.
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORIES, UNKNOWN_FILL, categoryLevel } from '../lib/aqi.js';

const tick = { fill: '#94a3b8', fontSize: 11 };
const tooltipStyle = { background: '#0f2038', border: 'none' };
const FORECAST_COLOR = '#fcd34d';
const BEST_HOUR_FILL = '#34d399';

/** Estimated past/current AQI as a solid area; forecast as a dashed line, joined at the current hour. */
export function TrendChart({ data, nowIndex }) {
  const nowLabel = data[nowIndex]?.label;
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="observedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2dd4bf" stopOpacity=".6" />
            <stop offset="95%" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={tick} minTickGap={50} />
        <YAxis tick={tick} />
        <Tooltip contentStyle={tooltipStyle} />
        {nowLabel && (
          <ReferenceLine
            x={nowLabel}
            stroke="#e2e8f0"
            strokeDasharray="2 2"
            label={{ value: 'Now', fill: '#e2e8f0', fontSize: 11, position: 'top' }}
          />
        )}
        <Area
          dataKey="observed"
          name="Estimated (past to now)"
          stroke="#2dd4bf"
          fill="url(#observedFill)"
          connectNulls={false}
          isAnimationActive={false}
        />
        <Area
          dataKey="forecast"
          name="Forecast"
          stroke={FORECAST_COLOR}
          strokeDasharray="5 4"
          fill="none"
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const barFill = (point, best) => {
  if (best.includes(point.hour)) {
    return BEST_HOUR_FILL;
  }
  const level = categoryLevel(point.aqi);
  return level === null ? UNKNOWN_FILL : CATEGORIES[level].fill;
};

/** Next-24-hour forecast bars, coloured by category; the cleanest hours are highlighted. */
export function HourlyChart({ data, best }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <XAxis dataKey="hour" tick={tick} />
        <YAxis tick={tick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="aqi" name="Forecast AQI" isAnimationActive={false}>
          {data.map((point) => (
            <Cell key={point.t} fill={barFill(point, best)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
