import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../../src/App.jsx';
import Dash from '../../src/components/Dash.jsx';
import Family from '../../src/components/Family.jsx';
import Indoor from '../../src/components/Indoor.jsx';
import Plan from '../../src/components/Plan.jsx';
import Status from '../../src/components/Status.jsx';
import { NumberField } from '../../src/components/common.jsx';
import { makeAqi, mockFetch } from './fixtures.js';

vi.mock('../../src/components/AqiCharts.jsx', () => ({
  TrendChart: () => null,
  HourlyChart: () => null,
}));

const a11y = async (container) => {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map((v) => v.id)).toEqual([]);
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Status (before the first reading arrives)', () => {
  it('offers to load, shows progress, and shows an error with Retry/demo', async () => {
    const load = vi.fn();
    const user = userEvent.setup();
    const { rerender, container } = render(
      <Status loading={false} error={null} load={load} city="Pune" title="Air Quality" />,
    );
    await user.click(screen.getByRole('button', { name: 'Load air quality' }));
    expect(load).toHaveBeenCalledWith('Pune');

    rerender(<Status loading error={null} load={load} city="Pune" title="Air Quality" />);
    expect(screen.getByText('Fetching air quality for Pune…')).toBeInTheDocument();
    expect(container.querySelector('section')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <Status
        loading={false}
        error={{ message: 'down', canDemo: true }}
        load={load}
        city="Pune"
        title="Air Quality"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await user.click(screen.getByRole('button', { name: 'Use demo mode' }));
    expect(load).toHaveBeenLastCalledWith('Pune', true);
    await a11y(container);

    rerender(
      <Status
        loading={false}
        error={{ message: 'nope', canDemo: false }}
        load={load}
        city="Pune"
        title="Air Quality"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Use demo mode' })).toBeNull();
  });
});

describe('Indoor air advice follows the data', () => {
  it.each([
    [undefined, /Load air quality \(Air Quality tab\)/],
    [makeAqi({ aqi: null }), /AQI is unavailable right now/],
    [makeAqi({ aqi: 250 }), /AQI 250: keep windows closed/],
    [makeAqi({ aqi: 80 }), /AQI 80: brief cross-ventilation is reasonable/],
  ])('ventilation advice for %#', (airQuality, pattern) => {
    render(<Indoor airQuality={airQuality} />);
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });
});

describe('Daily planner branches', () => {
  it('shows a cautious note and "n/a" when no AQI/best hours exist', () => {
    render(<Plan airQuality={makeAqi({ aqi: null })} />);
    expect(screen.getByRole('note')).toHaveTextContent(/AQI value is not available/);
    expect(screen.getByText(/Lowest forecast hours/).querySelector('b')).toHaveTextContent('n/a');
    expect(screen.getByRole('img', { name: /No AQI values are available/ })).toBeInTheDocument();
  });
  it('recommends indoor exercise at severe levels and outdoor in the green hours otherwise', () => {
    const { unmount } = render(<Plan airQuality={makeAqi({ aqi: 380 })} />);
    expect(screen.getByText(/Exercise indoors/)).toBeInTheDocument();
    unmount();
    render(<Plan airQuality={makeAqi({ aqi: 40 })} />);
    expect(
      screen.getByText(/Outdoor exercise is reasonable in the green hours/),
    ).toBeInTheDocument();
  });
});

describe('Dashboard actions', () => {
  const state = (overrides = {}) => ({
    loading: false,
    refreshing: false,
    isStale: false,
    dataAgeMs: 0,
    error: null,
    refresh: vi.fn(),
    load: vi.fn(),
    ...overrides,
  });

  it('offers demo mode after a recoverable error and passes the typed city', async () => {
    const aqiState = state({
      error: { message: 'Live air quality service is unavailable right now.', canDemo: true },
    });
    const user = userEvent.setup();
    const { container } = render(
      <Dash
        airQuality={makeAqi()}
        aqiState={aqiState}
        citySearch={{ city: 'Pune', setCity: vi.fn() }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Use demo mode' }));
    expect(aqiState.load).toHaveBeenCalledWith('Pune', true);
    expect(screen.getByLabelText('Search a city')).toHaveAttribute(
      'aria-describedby',
      'dash-city-error',
    );
    await a11y(container);
  });

  it('calls refresh as a manual action and searches via the form', async () => {
    const aqiState = state();
    const user = userEvent.setup();
    render(
      <Dash
        airQuality={makeAqi()}
        aqiState={aqiState}
        citySearch={{ city: 'Delhi', setCity: vi.fn() }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Refresh now' }));
    expect(aqiState.refresh).toHaveBeenCalledWith({ manual: true });
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(aqiState.load).toHaveBeenCalledWith('Delhi');
  });

  it('typing updates the city', async () => {
    const setCity = vi.fn();
    render(<Dash airQuality={makeAqi()} aqiState={state()} citySearch={{ city: '', setCity }} />);
    await userEvent.setup().type(screen.getByLabelText('Search a city'), 'P');
    expect(setCity).toHaveBeenCalledWith('P');
  });
});

describe('Family report', () => {
  const family = (members = []) => ({
    members,
    cloudEnabled: false,
    addMember: vi.fn(),
    removeMember: vi.fn(),
  });

  it('prints the report on request and marks AQI unavailable in the heading', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<Family airQuality={makeAqi({ aqi: null })} family={family()} />);
    expect(
      screen.getByRole('heading', { level: 2, name: /AQI unavailable, Unavailable/ }),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Print report' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('gives each member guidance for their category and tier', () => {
    render(
      <Family
        airQuality={makeAqi({ aqi: 350 })}
        family={family([
          { id: '1', name: 'Asha', type: 'elderly' },
          { id: '2', name: 'Raj', type: 'worker' },
          { id: '3', name: 'Kim', type: 'adult' },
        ])}
      />,
    );
    expect(screen.getByText(/Stay indoors, avoid exertion outdoors/)).toBeInTheDocument();
    expect(
      screen.getByText(/Use a fitted N95\/FFP2, shorten continuous exposure/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Keep windows shut in peak hours/)).toBeInTheDocument();
  });
});

describe('calculators', () => {
  it('NumberField coerces cleared or invalid input to 0 instead of NaN', async () => {
    const onChange = vi.fn();
    render(<NumberField label="Distance" value={5} onChange={onChange} />);
    const input = screen.getByLabelText('Distance');
    await userEvent.setup().clear(input);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('Impact: editing emission factors and the appliance/reusable inputs updates the results', async () => {
    mockFetch({ '/api/family': { enabled: false, items: [] }, '/api/aqi': makeAqi() });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Impact' }));
    await screen.findByRole('heading', { level: 1, name: /environmental impact/i });

    const table = screen.getByRole('table', { name: /editable emission/i });
    const carCost = within(table).getByLabelText('Petrol car (1 person): rupees per km');
    await user.clear(carCost);
    await user.type(carCost, '10');
    expect(screen.getByText('₹2805')).toBeInTheDocument(); // (10 - 1.5) * 15 * 22

    await user.clear(screen.getByLabelText('Disposable ₹/item'));
    await user.type(screen.getByLabelText('Disposable ₹/item'), '3');
    expect(screen.getByText('₹180')).toBeInTheDocument(); // 3 * 60
    await user.clear(screen.getByLabelText('Conventional (W)'));
    await user.type(screen.getByLabelText('Conventional (W)'), '1000');
    expect(screen.getByText('₹144')).toBeInTheDocument(); // 0.1 kW * 6 h * 30 d = 18 kWh, at ₹8/kWh
    expect(screen.getByText('18')).toBeInTheDocument(); // kWh saved per month
  });
});
