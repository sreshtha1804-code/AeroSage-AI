import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../../src/App.jsx';
import { toHistory } from '../../src/components/Chat.jsx';
import { json, makeAqi, mockFetch } from './fixtures.js';

// Recharts needs real layout; the chart modules are replaced by lightweight stand-ins.
vi.mock('../../src/components/AqiCharts.jsx', () => ({
  TrendChart: () => <div data-testid="trend-chart" />,
  HourlyChart: () => <div data-testid="hourly-chart" />,
}));

const user = () => userEvent.setup();

/** axe-core scan (colour contrast is covered separately: jsdom has no layout/colour engine). */
async function expectNoA11yViolations(container) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`,
  );
  expect(summary).toEqual([]);
}

const baseRoutes = (aqi = makeAqi()) => ({
  '/api/aqi': aqi,
  '/api/family': { enabled: false, items: [] },
});

beforeEach(() => {
  localStorage.clear();
  document.title = '';
});
afterEach(() => vi.unstubAllGlobals());

async function openDashboard(routes = baseRoutes()) {
  const f = mockFetch(routes);
  const u = user();
  const view = render(<App />);
  await u.click(screen.getByRole('button', { name: /check my air now/i }));
  await screen.findByRole('heading', { level: 1, name: /air quality in kolkata/i });
  return { u, f, ...view };
}

describe('landing page', () => {
  it('has one h1, a skip link and labelled search, and passes axe', async () => {
    mockFetch(baseRoutes());
    const { container } = render(<App />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByLabelText('City')).toHaveValue('Kolkata');
    expect(document.title).toMatch(/AeroSage AI/);
    await expectNoA11yViolations(container);
  });

  it('every navigation button has an accessible name (labels are not hidden on mobile)', () => {
    mockFetch(baseRoutes());
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const b of within(nav).getAllByRole('button')) expect(b).toHaveAccessibleName();
  });
});

describe('air quality dashboard', () => {
  it('loads live data, shows AQI as text with category, and announces it', async () => {
    const { f } = await openDashboard();
    expect(f.mock.calls.find(([u]) => String(u).includes('/api/aqi'))[0]).toContain('city=Kolkata');
    const gauge = screen.getByRole('region', { name: 'Current air quality index' });
    expect(within(gauge).getByText('232')).toBeInTheDocument();
    expect(screen.getAllByText(/Poor/).length).toBeGreaterThan(0);
    expect(screen.getByText('Live model data')).toBeInTheDocument();
    const live = screen
      .getAllByRole('status')
      .map((n) => n.textContent)
      .join(' ');
    expect(live).toMatch(/Air quality for Kolkata: AQI 232, Poor/);
    expect(document.title).toMatch(/Air Quality – AeroSage AI/);
  });

  it('marks the current category with aria-current and text, not just colour', async () => {
    await openDashboard();
    const list = screen.getByRole('list', { name: 'AQI categories' });
    const current = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(/Poor 201–300 \(current\)/);
  });

  it('provides a chart text alternative and a data table', async () => {
    const { u } = await openDashboard();
    expect(
      screen.getByRole('img', { name: /AQI trend from .* Daily averages/ }),
    ).toBeInTheDocument();
    await u.click(screen.getByText(/view chart data as a table/i));
    const table = screen.getByRole('table', { name: /daily aqi summary/i });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(2);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toContain('Average AQI');
  });

  it('shows accessible placeholders for missing pollutants and N/A for unknown AQI', async () => {
    await openDashboard(baseRoutes(makeAqi({ aqi: null })));
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText(/No AQI could be calculated/)).toBeInTheDocument();
    expect(screen.getAllByText('not available').length).toBeGreaterThan(0);
  });

  it('searches another city using a labelled field', async () => {
    const { u, f } = await openDashboard();
    const input = screen.getByLabelText('Search a city');
    await u.clear(input);
    await u.type(input, 'Delhi');
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(f.mock.calls.some(([url]) => String(url).includes('city=Delhi'))).toBe(true),
    );
  });

  it('passes axe', async () => {
    const { container } = await openDashboard();
    await expectNoA11yViolations(container);
  });
});

describe('loading and error states', () => {
  it('shows a status while loading', async () => {
    mockFetch({
      '/api/aqi': () => new Promise(() => {}),
      '/api/family': { enabled: false, items: [] },
    });
    const u = user();
    render(<App />);
    await u.click(screen.getByRole('button', { name: /check my air now/i }));
    expect(await screen.findByText(/Fetching air quality for Kolkata/)).toBeInTheDocument();
  });

  it('shows an alert with Retry and demo mode when the live service is down, then recovers via demo', async () => {
    const demo = makeAqi({ demo: true, name: 'Kolkata' });
    mockFetch({
      '/api/aqi': (url) =>
        String(url).includes('demo=1')
          ? demo
          : json(
              { error: 'Live air quality service is unavailable right now.', canDemo: true },
              502,
            ),
      '/api/family': { enabled: false, items: [] },
    });
    const u = user();
    const { container } = render(<App />);
    await u.click(screen.getByRole('button', { name: /check my air now/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/unavailable right now/);
    await expectNoA11yViolations(container);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /use demo mode/i }));
    expect(await screen.findByText(/DEMO MODE – synthetic data/)).toBeInTheDocument();
  });

  it('does not offer demo mode for an unknown city', async () => {
    mockFetch({
      '/api/aqi': json({ error: 'Could not find "Zzz".' }, 404),
      '/api/family': { enabled: false, items: [] },
    });
    const u = user();
    render(<App />);
    await u.click(screen.getByRole('button', { name: /check my air now/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not find "Zzz"/);
    expect(screen.queryByRole('button', { name: /use demo mode/i })).toBeNull();
  });

  it('explains network failure in plain language', async () => {
    mockFetch({
      '/api/family': { enabled: false, items: [] },
      '/api/aqi': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const u = user();
    render(<App />);
    await u.click(screen.getByRole('button', { name: /check my air now/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the server/);
  });
});

describe('navigation', () => {
  it('moves focus to the new page heading and updates the document title', async () => {
    const { u } = await openDashboard();
    await u.click(screen.getByRole('button', { name: 'Daily Planner' }));
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Daily planner' });
    await waitFor(() => expect(h1).toHaveFocus());
    expect(document.title).toBe('Daily Planner – AeroSage AI');
    expect(screen.getByRole('button', { name: 'Daily Planner' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('loads data automatically when opening a data page directly', async () => {
    const f = mockFetch(baseRoutes());
    const u = user();
    render(<App />);
    await u.click(screen.getByRole('button', { name: 'AI Assistant' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /AeroSage AI Assistant/ }),
    ).toBeInTheDocument();
    expect(f.mock.calls.filter(([url]) => String(url).includes('/api/aqi'))).toHaveLength(1);
  });

  it('daily planner lists cleanest hours and has a table alternative', async () => {
    const { u } = await openDashboard();
    await u.click(screen.getByRole('button', { name: 'Daily Planner' }));
    await screen.findByRole('heading', { level: 1, name: 'Daily planner' });
    expect(screen.getByText(/Lowest forecast hours between 5am–9pm/)).toBeInTheDocument();
    await u.click(screen.getByText(/view hourly data as a table/i));
    expect(screen.getByRole('table', { name: /next 24 hours/i })).toBeInTheDocument();
  });

  it.each(['Daily Planner', 'Indoor Air', 'Impact', 'Family', 'About', 'AI Assistant'])(
    '%s page passes axe',
    async (name) => {
      const { u, container } = await openDashboard();
      await u.click(screen.getByRole('button', { name }));
      await screen.findByRole('heading', { level: 1 });
      await expectNoA11yViolations(container);
    },
  );
});

describe('AI assistant', () => {
  const chatRoutes = (chat) => ({ ...baseRoutes(), '/api/chat': chat });

  async function openChat(chat) {
    const ctx = await openDashboard(chatRoutes(chat));
    await ctx.u.click(screen.getByRole('button', { name: 'AI Assistant' }));
    await screen.findByRole('log', { name: /conversation/i });
    return ctx;
  }

  it('sends the message with sanitised context and shows a Gemini reply labelled as AI', async () => {
    const { u, f } = await openChat({ text: 'Keep windows closed.', ai: true, source: 'gemini' });
    await u.type(screen.getByLabelText('Your question'), 'Is it safe to jog?');
    await u.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Keep windows closed.')).toBeInTheDocument();
    expect(screen.getByText('AI-generated by Gemini')).toBeInTheDocument();
    const body = JSON.parse(
      f.mock.calls.find(([url]) => String(url).includes('/api/chat'))[1].body,
    );
    expect(body).toMatchObject({
      message: 'Is it safe to jog?',
      context: { place: 'Kolkata', aqi: 232, category: 'Poor', demo: false },
    });
    expect(screen.getByLabelText('Your question')).toHaveValue('');
  });

  it('clearly labels fallback replies as NOT AI-generated', async () => {
    await openChat({
      text: 'The AI assistant is unavailable right now…',
      ai: false,
      source: 'fallback',
      note: 'The AI service is busy (rate limited). Basic guidance is shown instead.',
    });
    const u = user();
    await u.click(screen.getByRole('button', { name: /best time for a morning walk/i }));
    expect(await screen.findByText(/Basic guidance, not AI-generated/)).toBeInTheDocument();
    expect(screen.getByText(/rate limited/)).toBeInTheDocument();
    expect(screen.queryByText('AI-generated by Gemini')).toBeNull();
  });

  it('shows the server error (e.g. rate limit) without crashing', async () => {
    await openChat(
      json({ error: 'Too many assistant messages. Please wait a minute and try again.' }, 429),
    );
    const u = user();
    await u.type(screen.getByLabelText('Your question'), 'hello');
    await u.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(/Too many assistant messages/)).toBeInTheDocument();
  });

  it('shows a friendly message when the server is unreachable', async () => {
    await openChat(() => {
      throw new TypeError('Failed to fetch');
    });
    const u = user();
    await u.type(screen.getByLabelText('Your question'), 'hello');
    await u.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it('disables Send for empty input and announces the thinking state', async () => {
    let release;
    await openChat(
      () =>
        new Promise((r) => {
          release = r;
        }),
    );
    const u = user();
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();
    await u.type(screen.getByLabelText('Your question'), 'hello');
    await u.click(send);
    expect(await screen.findByText('AeroSage AI is thinking…')).toBeInTheDocument();
    release(json({ text: 'done', ai: true, source: 'gemini' }));
    expect(await screen.findByText('done')).toBeInTheDocument();
  });

  it('keeps the conversation when switching tabs and back', async () => {
    const { u } = await openChat({ text: 'Remember me.', ai: true, source: 'gemini' });
    await u.click(screen.getByRole('button', { name: /kids to play outside/i }));
    await screen.findByText('Remember me.');
    await u.click(screen.getByRole('button', { name: 'Air Quality' }));
    await u.click(screen.getByRole('button', { name: 'AI Assistant' }));
    expect(await screen.findByText('Remember me.')).toBeInTheDocument();
  });

  it('only sends genuine Gemini replies back as history', () => {
    expect(
      toHistory([
        { role: 'user', text: 'q1' },
        { role: 'ai', text: 'fallback', source: 'fallback' },
        { role: 'user', text: 'q2' },
        { role: 'ai', text: 'real', source: 'gemini' },
        { role: 'ai', text: 'err', source: 'error' },
      ]),
    ).toEqual([
      { role: 'user', text: 'q1' },
      { role: 'user', text: 'q2' },
      { role: 'model', text: 'real' },
    ]);
  });
});

describe('family profiles', () => {
  async function openFamily(routes = baseRoutes()) {
    const ctx = await openDashboard(routes);
    await ctx.u.click(screen.getByRole('button', { name: 'Family' }));
    await screen.findByRole('heading', { level: 1, name: 'Family safety' });
    return ctx;
  }

  it('adds a member, shows tailored guidance, persists locally and announces it', async () => {
    const { u } = await openFamily();
    expect(screen.getByText(/Add members to generate tailored guidance/)).toBeInTheDocument();
    await u.type(screen.getByLabelText('Family member name'), 'Mia');
    await u.selectOptions(screen.getByLabelText('Category'), 'child');
    await u.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Mia')).toBeInTheDocument();
    expect(screen.getByText(/Shorten intense outdoor play/)).toBeInTheDocument();
    expect(screen.getByText('Added Mia.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('aerosage_family'))).toHaveLength(1);
  });

  it('validates an empty name with an accessible message', async () => {
    const { u } = await openFamily();
    await u.click(screen.getByRole('button', { name: 'Add member' }));
    expect(screen.getByText('Please enter a name.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: /./ })).toBeNull();
  });

  it('removes a member via a named button', async () => {
    const { u } = await openFamily();
    await u.type(screen.getByLabelText('Family member name'), 'Raj');
    await u.click(screen.getByRole('button', { name: 'Add member' }));
    await u.click(await screen.findByRole('button', { name: 'Remove Raj' }));
    await waitFor(() => expect(screen.queryByText('Raj')).toBeNull());
    expect(screen.getByText('Removed Raj.')).toBeInTheDocument();
  });

  it('uses cloud storage when Supabase is enabled and falls back to the device if saving fails', async () => {
    const saved = { id: '223e4567-e89b-12d3-a456-426614174001', name: 'Asha', type: 'elderly' };
    const routes = {
      '/api/aqi': makeAqi(),
      '/api/family': (url, init) => {
        if (init?.method === 'POST') return json({ error: 'down' }, 502);
        return { enabled: true, items: [saved] };
      },
    };
    const { u } = await openFamily(routes);
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    expect(screen.getByText(/sync to your cloud profile/)).toBeInTheDocument();
    await u.type(screen.getByLabelText('Family member name'), 'Local');
    await u.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Local')).toBeInTheDocument();
  });

  it('shows cautious guidance and a notice when AQI is unavailable', async () => {
    await openFamily(baseRoutes(makeAqi({ aqi: null })));
    expect(screen.getByRole('note')).toHaveTextContent(/AQI value is not available/);
  });
});

describe('indoor and impact calculators', () => {
  it('recomputes purifier size when the room area changes', async () => {
    const { u } = await openDashboard();
    await u.click(screen.getByRole('button', { name: 'Indoor Air' }));
    await screen.findByRole('heading', { level: 1, name: /indoor air quality/i });
    expect(screen.getByText(/≈87 cfm/)).toBeInTheDocument();
    const area = screen.getByLabelText(/Room area/);
    await u.clear(area);
    await u.type(area, '20');
    expect(screen.getByText(/≈144 cfm/)).toBeInTheDocument();
    expect(screen.getByText(/AQI 232: keep windows closed/)).toBeInTheDocument();
  });

  it('commute calculator updates savings and every table input has a name', async () => {
    const { u } = await openDashboard();
    await u.click(screen.getByRole('button', { name: 'Impact' }));
    await screen.findByRole('heading', { level: 1, name: /environmental impact/i });
    expect(screen.getByText('₹2475')).toBeInTheDocument(); // (9-1.5) * 15 * 22
    await u.selectOptions(screen.getByLabelText('To'), 'bike');
    expect(screen.getByText('₹1980')).toBeInTheDocument(); // (9-3) * 15 * 22
    const table = screen.getByRole('table', { name: /editable emission/i });
    for (const input of within(table).getAllByRole('spinbutton'))
      expect(input).toHaveAccessibleName();
  });
});
