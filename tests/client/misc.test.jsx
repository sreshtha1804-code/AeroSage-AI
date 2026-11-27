import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../../src/components/ErrorBoundary.jsx';
import { HourlyChart, TrendChart } from '../../src/components/AqiCharts.jsx';
import { makeAqi } from './fixtures.js';

afterEach(() => vi.restoreAllMocks());

function Boom() {
  throw new Error('render failure');
}

describe('ErrorBoundary', () => {
  it('renders children normally', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('shows an accessible alert with a reload button instead of a blank page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom reports the (intentional) render error as an uncaught window error; swallow it for this test only.
    const swallow = (event) => event.preventDefault();
    window.addEventListener('error', swallow);
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalled();
    window.removeEventListener('error', swallow);
    vi.unstubAllGlobals();
  });
});

describe('chart components', () => {
  const series = makeAqi().series.map((s, i) => ({ ...s, label: `L${i}`, h: i % 24 }));
  it('render with real and missing AQI values without throwing', () => {
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RO);
    const withGap = series.map((s, i) => (i === 3 ? { ...s, aqi: null } : s));
    expect(() => render(<TrendChart data={withGap} />)).not.toThrow();
    expect(() =>
      render(<HourlyChart data={withGap.slice(0, 24)} best={[5, 6, 7]} />),
    ).not.toThrow();
    vi.unstubAllGlobals();
  });
});
