import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../../src/App.jsx';
import AqiGauge from '../../src/components/AqiGauge.jsx';
import CitySearchForm from '../../src/components/CitySearchForm.jsx';
import DataProvenance from '../../src/components/DataProvenance.jsx';
import PollutantGrid from '../../src/components/PollutantGrid.jsx';
import RefreshBar from '../../src/components/RefreshBar.jsx';
import { StaleNotice } from '../../src/components/common.jsx';
import { countCalls, json, makeAqi, mockFetch } from './fixtures.js';

vi.mock('../../src/components/AqiCharts.jsx', () => ({
  TrendChart: ({ nowIndex }) => <div data-testid="trend-chart" data-now={nowIndex} />,
  HourlyChart: () => <div data-testid="hourly-chart" />,
}));

const a11y = async (container) => {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`),
  ).toEqual([]);
};

const routes = (aqi = makeAqi()) => ({
  '/api/aqi': aqi,
  '/api/family': { enabled: false, items: [] },
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('request efficiency (regression)', () => {
  it('one click on the landing page sends exactly ONE air-quality request', async () => {
    const f = mockFetch(routes());
    render(<App />);
    await userEvent.setup().click(screen.getByRole('button', { name: /check my air now/i }));
    await screen.findByRole('heading', { level: 1, name: /air quality in kolkata/i });
    expect(countCalls(f, '/api/aqi')).toBe(1);
  });

  it('submitting the landing form also sends exactly one request', async () => {
    const f = mockFetch(routes());
    render(<App />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Check air' }));
    await screen.findByRole('heading', { level: 1, name: /air quality in kolkata/i });
    expect(countCalls(f, '/api/aqi')).toBe(1);
  });

  it('visiting several data pages reuses the same data (still one request)', async () => {
    const f = mockFetch(routes());
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Daily Planner' }));
    await screen.findByRole('heading', { level: 1, name: 'Daily planner' });
    await user.click(screen.getByRole('button', { name: 'Family' }));
    await screen.findByRole('heading', { level: 1, name: 'Family safety' });
    await user.click(screen.getByRole('button', { name: 'Air Quality' }));
    await screen.findByRole('heading', { level: 1, name: /air quality in/i });
    expect(countCalls(f, '/api/aqi')).toBe(1);
  });

  it('does not auto-retry after a failure (the user decides via Retry)', async () => {
    const f = mockFetch({
      '/api/family': { enabled: false, items: [] },
      '/api/aqi': json({ error: 'down', canDemo: true }, 502),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Daily Planner' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Family' }));
    expect(countCalls(f, '/api/aqi')).toBe(1);
  });
});

async function openDashboard(aqi = makeAqi(), extraRoutes = {}) {
  const f = mockFetch({ ...routes(aqi), ...extraRoutes });
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole('button', { name: /check my air now/i }));
  await screen.findByRole('heading', { level: 1, name: /air quality in/i });
  return { f, user, ...view };
}

describe('manual refresh and stale data', () => {
  it('Refresh now re-queries, shows a busy state, and does not clear the displayed reading', async () => {
    let release;
    const { f, user } = await openDashboard();
    f.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(json(makeAqi({ aqi: 120 })));
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh now' }));
    const busy = await screen.findByRole('button', { name: 'Refreshing…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(
      within(screen.getByRole('region', { name: 'Current air quality index' })).getByText('232'),
    ).toBeInTheDocument();
    await act(async () => release());
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Current air quality index' })).getByText('120'),
      ).toBeInTheDocument(),
    );
    expect(countCalls(f, '/api/aqi')).toBe(2);
    expect(screen.getByText(/Air quality for Kolkata: AQI 120, Moderate/)).toBeInTheDocument(); // announced for manual refresh
  });

  it('keeps the last reading visible and labels it stale when a refresh fails', async () => {
    const { f, user, container } = await openDashboard();
    f.mockImplementation(async () =>
      json({ error: 'Live air quality service is unavailable right now.', canDemo: true }, 502),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh now' }));
    const notice = await screen.findByText(/Stale data\./);
    expect(notice.closest('[role="status"]')).toHaveTextContent(/latest refresh failed/i);
    expect(notice.closest('[role="status"]')).toHaveTextContent(/Showing the last valid reading/);
    expect(screen.getByText('Stale', { selector: 'span' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Current air quality index' })).getByText('232'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(/unavailable right now/);
    await a11y(container);
  });

  it('shows the stale notice on other data pages too', async () => {
    const { f, user } = await openDashboard();
    f.mockImplementation(async () => json({ error: 'down', canDemo: true }, 502));
    await user.click(screen.getByRole('button', { name: 'Refresh now' }));
    await screen.findByText(/Stale data\./);
    await user.click(screen.getByRole('button', { name: 'Daily Planner' }));
    expect(await screen.findByText(/Stale data\./)).toBeInTheDocument();
  });

  it('flags server-reported stale readings (provider outage served from cache)', async () => {
    await openDashboard(makeAqi({ stale: true }));
    expect(screen.getByText(/Stale data\./)).toBeInTheDocument();
    expect(screen.getByText(/provider may be unavailable/i)).toBeInTheDocument();
  });

  it('explains that refreshing does not guarantee a newer reading, and has no refresh for demo data', async () => {
    await openDashboard();
    expect(screen.getByText(/Refreshing does not guarantee a newer reading/)).toBeInTheDocument();
  });

  it('demo data cannot be refreshed and says so', async () => {
    mockFetch({
      '/api/family': { enabled: false, items: [] },
      '/api/aqi': (url) =>
        String(url).includes('demo=1')
          ? makeAqi({ demo: true })
          : json({ error: 'down', canDemo: true }, 502),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /check my air now/i }));
    await user.click(await screen.findByRole('button', { name: /use demo mode/i }));
    await screen.findByText('DEMO MODE – synthetic data');
    expect(screen.queryByRole('button', { name: 'Refresh now' })).toBeNull();
    expect(screen.getByText(/Demo values are synthetic and never refresh/)).toBeInTheDocument();
    expect(screen.queryByText(/Stale data\./)).toBeNull();
  });
});

describe('data transparency', () => {
  it('states provider, data type, selected city, model time zone and that forecasts are predictions', async () => {
    await openDashboard();
    const panel = screen.getByRole('region', { name: 'Data sources and method' });
    expect(within(panel).getByText('Open-Meteo (CAMS model)')).toBeInTheDocument();
    expect(
      within(panel).getByText(/Model estimate .* not a ground-station measurement/),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Kolkata, West Bengal, India')).toBeInTheDocument();
    expect(within(panel).getByText(/Asia\/Kolkata/)).toBeInTheDocument();
    expect(within(panel).getByText(/predictions, not measurements/)).toBeInTheDocument();
  });

  it('explains how the AQI is estimated', async () => {
    const { user } = await openDashboard();
    await user.click(screen.getByText('How the AQI is estimated'));
    expect(screen.getByText(/Estimated CPCB-style AQI: highest sub-index/)).toBeInTheDocument();
  });

  it('labels the AQI as an estimate, says how many pollutants it used, and shows units and sub-indices', async () => {
    await openDashboard();
    expect(screen.getAllByText(/Estimated AQI/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estimated CPCB-style AQI from 6 pollutants/)).toBeInTheDocument();
    const grid = screen.getByText('PM2.5').closest('dl');
    expect(within(grid).getAllByText('µg/m³').length).toBe(6);
    expect(within(grid).getByText(/Sub-index 232 · main pollutant/)).toBeInTheDocument();
  });

  it('separates observed (model) from forecast in the chart caption and daily table', async () => {
    const { user } = await openDashboard();
    expect(
      screen.getByText(/Dashed line: forecast \(a prediction, not a measurement\)/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toHaveAttribute('data-now', '72');
    await user.click(screen.getByText(/view chart data as a table/i));
    expect(screen.getByText(/\(includes forecast\)/)).toBeInTheDocument();
  });

  it('planner table distinguishes the current model estimate from forecast hours', async () => {
    const { user } = await openDashboard();
    await user.click(screen.getByRole('button', { name: 'Daily Planner' }));
    await screen.findByRole('heading', { level: 1, name: 'Daily planner' });
    await user.click(screen.getByText(/view hourly data as a table/i));
    const table = screen.getByRole('table', { name: /next 24 hours/i });
    expect(within(table).getAllByText('Now (model estimate)')).toHaveLength(1);
    expect(within(table).getAllByText('Forecast').length).toBe(23);
    expect(screen.getByText(/Best outdoor windows \(next 24h, forecast\)/)).toBeInTheDocument();
  });
});

describe('page identity', () => {
  it('home title and footer carry the official descriptor', () => {
    mockFetch(routes());
    render(<App />);
    expect(document.title).toBe('AeroSage AI – Smart Environmental Health Assistant');
    expect(screen.getByText(/Smart Environmental Health Assistant · Data:/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('contentinfo')).getByText(/Smarter Air\. Healthier Living\./),
    ).toBeInTheDocument();
  });
});

describe('components in isolation', () => {
  it('CitySearchForm links its field to an error message and is accessible', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <CitySearchForm
        id="c"
        city=""
        onCityChange={() => {}}
        onSubmit={onSubmit}
        submitLabel="Go"
        error="Please enter a city name."
      />,
    );
    const input = screen.getByLabelText('Search a city');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'c-error');
    expect(document.getElementById('c-error')).toHaveTextContent('Please enter a city name.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await a11y(container);
  });

  it('CitySearchForm without error has no aria-invalid and can hide its label', () => {
    render(
      <CitySearchForm
        id="h"
        city="Pune"
        onCityChange={() => {}}
        onSubmit={() => {}}
        submitLabel="Go"
        visibleLabel={false}
        busy
      />,
    );
    const input = screen.getByLabelText('City');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveValue('Pune');
    expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled();
  });

  it.each([
    ['full', /from 6 pollutants/],
    ['partial', /from 2 pollutants only \(fewer than the 3 CPCB normally requires\)/],
    ['synthetic', /Synthetic value for demonstration/],
    ['unavailable', /No AQI could be estimated/],
  ])('AqiGauge describes %s basis', (basis, pattern) => {
    render(
      <AqiGauge
        aqi={150}
        category="Moderate"
        aqiMeta={{ basis, pollutantsUsed: basis === 'full' ? 6 : 2 }}
      />,
    );
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });

  it('AqiGauge handles one-pollutant wording and a missing AQI', () => {
    const { rerender } = render(
      <AqiGauge aqi={90} category="Moderate" aqiMeta={{ basis: 'partial', pollutantsUsed: 1 }} />,
    );
    expect(screen.getByText(/from 1 pollutant only/)).toBeInTheDocument();
    rerender(<AqiGauge aqi={null} category="Unavailable" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText(/No AQI could be calculated/)).toBeInTheDocument();
  });

  it('PollutantGrid shows "not available" for missing values and omits unknown sub-indices', () => {
    render(
      <PollutantGrid
        current={{ pm25: 12.6, pm10: null, no2: undefined, so2: 3, o3: 4, co: 5, subIndices: {} }}
      />,
    );
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getAllByText('not available')).toHaveLength(2);
    expect(screen.queryByText(/Sub-index/)).toBeNull();
    expect(screen.getAllByText('µg/m³').length).toBe(4); // default unit when none supplied
  });

  it('RefreshBar shows age, stale flag, and no button for demo data', () => {
    const live = makeAqi({ fetchedAt: '2026-11-24T08:00:00.000Z' });
    const { rerender } = render(
      <RefreshBar
        data={live}
        dataAgeMs={5 * 60_000}
        isStale={false}
        refreshing={false}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText(/5 min ago/)).toBeInTheDocument();
    expect(screen.queryByText('Stale', { selector: 'span' })).toBeNull();
    rerender(
      <RefreshBar data={live} dataAgeMs={45 * 60_000} isStale refreshing onRefresh={() => {}} />,
    );
    expect(screen.getByText('Stale', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
    rerender(
      <RefreshBar
        data={makeAqi({ demo: true })}
        dataAgeMs={0}
        isStale={false}
        refreshing={false}
        onRefresh={() => {}}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('DataProvenance falls back gracefully for unknown data types and missing metadata', () => {
    const data = { ...makeAqi(), dataType: 'other', aqiMeta: undefined, place: { name: 'X' } };
    render(<DataProvenance data={data} dataAgeMs={0} />);
    expect(screen.getByText('other')).toBeInTheDocument();
    expect(screen.queryByText('How the AQI is estimated')).toBeNull();
  });

  it('StaleNotice is a polite status message', async () => {
    const { container } = render(
      <StaleNotice fetchedAtText="2:00 pm" reason="The latest refresh failed." />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      /Stale data\. The latest refresh failed\. Showing the last valid reading, retrieved 2:00 pm/,
    );
    await a11y(container);
  });
});
