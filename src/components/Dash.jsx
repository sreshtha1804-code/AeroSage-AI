import { Suspense, lazy, useMemo } from 'react';
import { describeTrend, summarizeByDay, toTrendChartData } from '../lib/aqi.js';
import AqiGauge from './AqiGauge.jsx';
import CitySearchForm from './CitySearchForm.jsx';
import DailySummaryTable from './DailySummaryTable.jsx';
import DataProvenance from './DataProvenance.jsx';
import PollutantGrid from './PollutantGrid.jsx';
import RefreshBar from './RefreshBar.jsx';
import { DataBadge, PageTitle, Spinner } from './common.jsx';

const TrendChart = lazy(() =>
  import('./AqiCharts.jsx').then((module) => ({ default: module.TrendChart })),
);

/** Air Quality page: current estimate, pollutants, trend/forecast and data provenance. */
export default function Dash({ airQuality, aqiState, citySearch }) {
  const { current, place } = airQuality;
  const { loading, refreshing, isStale, dataAgeMs, error, refresh, load } = aqiState;
  const chartData = useMemo(
    () => toTrendChartData(airQuality.series, airQuality.nowIndex),
    [airQuality],
  );
  const summary = useMemo(() => summarizeByDay(airQuality.series), [airQuality.series]);

  return (
    <div className="space-y-4">
      <PageTitle>Air quality in {place.name}</PageTitle>
      <CitySearchForm
        id="dash-city"
        city={citySearch.city}
        onCityChange={citySearch.setCity}
        onSubmit={() => load(citySearch.city)}
        submitLabel="Search"
        busy={loading}
        error={error?.message}
        className="flex flex-wrap items-end gap-2"
      />
      {error?.canDemo && (
        <p className="text-sm">
          <button className="underline" onClick={() => load(citySearch.city, true)}>
            Use demo mode
          </button>{' '}
          to explore the app with synthetic data.
        </p>
      )}
      <RefreshBar
        data={airQuality}
        dataAgeMs={dataAgeMs}
        isStale={isStale}
        refreshing={refreshing}
        onRefresh={() => refresh({ manual: true })}
      />
      <div className="grid gap-4 md:grid-cols-3" aria-busy={loading || refreshing}>
        <section className="card text-center" aria-label="Current air quality index">
          <p className="text-sm text-slate-300">
            {place.name}
            {place.admin ? `, ${place.admin}` : ''}
          </p>
          <AqiGauge aqi={current.aqi} category={current.category} aqiMeta={airQuality.aqiMeta} />
        </section>
        <section className="card md:col-span-2">
          <h2 className="mb-2 font-semibold">Current pollutants</h2>
          <PollutantGrid current={current} units={airQuality.units} />
          <p className="mt-3 text-xs text-slate-300">
            <DataBadge demo={airQuality.demo} /> Concentrations are model values for the current
            hour.
          </p>
        </section>
      </div>
      <section className="card">
        <h2 className="mb-2 font-semibold">
          Estimated AQI: past 3 days (model) and 2-day forecast
        </h2>
        <div role="img" aria-label={describeTrend(summary)} className="h-64">
          <Suspense fallback={<Spinner label="Loading chart…" />}>
            <TrendChart data={chartData} nowIndex={airQuality.nowIndex} />
          </Suspense>
        </div>
        <p className="mt-1 text-xs text-slate-300">
          Solid line: estimated from model data up to now. Dashed line: forecast (a prediction, not
          a measurement).
        </p>
        <DailySummaryTable summary={summary} caption="Daily AQI summary for the chart above" />
      </section>
      <DataProvenance data={airQuality} dataAgeMs={dataAgeMs} />
    </div>
  );
}
