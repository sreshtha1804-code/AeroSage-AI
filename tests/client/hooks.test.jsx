import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAqi } from '../../src/hooks/useAqi.js';
import { useAssistantChat } from '../../src/hooks/useAssistantChat.js';
import { useFamilyProfiles } from '../../src/hooks/useFamilyProfiles.js';
import { useNow } from '../../src/hooks/useNow.js';
import { countCalls, json, makeAqi, mockFetch } from './fixtures.js';

const MINUTE = 60_000;
const setVisibility = (state) =>
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setVisibility('visible');
  localStorage.clear();
});

describe('useAqi: loading', () => {
  it('loads data, clears loading and announces the result', async () => {
    mockFetch({ '/api/aqi': makeAqi() });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load());
    expect(result.current.data.place.name).toBe('Kolkata');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.announcement).toBe('Air quality for Kolkata: AQI 232, Poor');
  });

  it('announces "unavailable" instead of inventing a number', async () => {
    mockFetch({ '/api/aqi': makeAqi({ aqi: null }) });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load());
    expect(result.current.announcement).toBe(
      'Air quality for Kolkata: AQI unavailable, Unavailable',
    );
  });

  it('rejects blank input without calling the network', async () => {
    const f = mockFetch({});
    const { result } = renderHook(() => useAqi({ initialCity: '  ' }));
    await act(() => result.current.load());
    expect(f).not.toHaveBeenCalled();
    expect(result.current.error.message).toMatch(/city name/);
  });

  it('offers demo mode only when the server says so, or when unreachable', async () => {
    const { result } = renderHook(() => useAqi({ initialCity: 'X' }));
    mockFetch({ '/api/aqi': json({ error: 'Could not find "X".' }, 404) });
    await act(() => result.current.load());
    expect(result.current.error).toEqual({ message: 'Could not find "X".', canDemo: false });
    expect(result.current.announcement).toMatch(/^Error: Could not find/);
    mockFetch({ '/api/aqi': json({ error: 'down', canDemo: true }, 502) });
    await act(() => result.current.load());
    expect(result.current.error.canDemo).toBe(true);
    mockFetch({
      '/api/aqi': () => {
        throw new TypeError('offline');
      },
    });
    await act(() => result.current.load());
    expect(result.current.error.canDemo).toBe(true);
  });

  it('ignores a slow response that was superseded by a newer search', async () => {
    let releaseSlow;
    const slow = new Promise((resolve) => {
      releaseSlow = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url, init) =>
        String(url).includes('Slow')
          ? slow.then(() =>
              init.signal.aborted
                ? Promise.reject(new DOMException('aborted', 'AbortError'))
                : json(makeAqi({ name: 'Slow' })),
            )
          : Promise.resolve(json(makeAqi({ name: 'Fast' }))),
      ),
    );
    const { result } = renderHook(() => useAqi());
    let slowCall;
    act(() => {
      slowCall = result.current.load('Slow');
    });
    await act(() => result.current.load('Fast'));
    releaseSlow();
    await act(() => slowCall);
    await waitFor(() => expect(result.current.data.place.name).toBe('Fast'));
    expect(result.current.loading).toBe(false);
  });
});

describe('useAqi: refresh, stale data and staleness', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-11-24T08:00:00Z') }));

  it('refresh re-queries the loaded city (not whatever is typed) and keeps the UI in "refreshing", not "loading"', async () => {
    const f = mockFetch({ '/api/aqi': makeAqi() });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load('Kolkata'));
    act(() => result.current.setCity('Delhi'));
    let pending;
    act(() => {
      pending = result.current.refresh();
    });
    expect(result.current.refreshing).toBe(true);
    expect(result.current.loading).toBe(false);
    await act(() => pending);
    expect(String(f.mock.calls.at(-1)[0])).toContain('city=Kolkata');
    expect(result.current.refreshing).toBe(false);
  });

  it('announces only manual refreshes, not background ones', async () => {
    mockFetch({ '/api/aqi': makeAqi() });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load());
    const afterLoad = result.current.announcement;
    mockFetch({ '/api/aqi': makeAqi({ aqi: 120 }) });
    await act(() => result.current.refresh());
    expect(result.current.announcement).toBe(afterLoad);
    await act(() => result.current.refresh({ manual: true }));
    expect(result.current.announcement).toBe('Air quality for Kolkata: AQI 120, Moderate');
  });

  it('refresh does nothing before the first load and for demo data', async () => {
    const f = mockFetch({ '/api/aqi': makeAqi({ demo: true }) });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.refresh());
    expect(f).not.toHaveBeenCalled();
    await act(() => result.current.load('Kolkata', true));
    await act(() => result.current.refresh());
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('keeps the last valid reading when a refresh fails, labels it stale, and recovers on success', async () => {
    mockFetch({ '/api/aqi': makeAqi() });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load());
    expect(result.current.isStale).toBe(false);

    mockFetch({
      '/api/aqi': json(
        { error: 'Live air quality service is unavailable right now.', canDemo: true },
        502,
      ),
    });
    await act(() => result.current.refresh({ manual: true }));
    expect(result.current.data.current.aqi).toBe(232); // last valid reading preserved
    expect(result.current.error.message).toMatch(/unavailable/);
    expect(result.current.isStale).toBe(true);

    mockFetch({ '/api/aqi': makeAqi({ aqi: 90 }) });
    await act(() => result.current.refresh());
    expect(result.current.data.current.aqi).toBe(90);
    expect(result.current.error).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('marks data stale by age (> 30 min), by the server flag, and never for demo data', async () => {
    mockFetch({
      '/api/aqi': makeAqi({ fetchedAt: new Date('2026-11-24T08:00:00Z').toISOString() }),
    });
    const { result } = renderHook(() => useAqi({ refreshIntervalMs: 0 }));
    await act(() => result.current.load());
    expect(result.current.isStale).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(29 * MINUTE));
    expect(result.current.isStale).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(2 * MINUTE));
    expect(result.current.isStale).toBe(true);
    expect(result.current.dataAgeMs).toBeGreaterThan(30 * MINUTE);

    mockFetch({ '/api/aqi': makeAqi({ stale: true }) });
    await act(() => result.current.load());
    expect(result.current.isStale).toBe(true);

    mockFetch({ '/api/aqi': makeAqi({ demo: true, fetchedAt: '2020-01-01T00:00:00Z' }) });
    await act(() => result.current.load('X', true));
    expect(result.current.isStale).toBe(false);
  });
});

describe('useAqi: automatic refresh', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-11-24T08:00:00Z') }));

  it('re-checks every 15 minutes while the tab is visible', async () => {
    const f = mockFetch({ '/api/aqi': () => json(makeAqi()) });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load());
    expect(countCalls(f, '/api/aqi')).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(14 * MINUTE));
    expect(countCalls(f, '/api/aqi')).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(1 * MINUTE + 100));
    expect(countCalls(f, '/api/aqi')).toBe(2);
  });

  it('does not poll while the tab is hidden, and catches up when it becomes visible again', async () => {
    const f = mockFetch({ '/api/aqi': () => json(makeAqi()) });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load());
    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(45 * MINUTE));
    expect(countCalls(f, '/api/aqi')).toBe(1);
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(countCalls(f, '/api/aqi')).toBe(2);
  });

  it('does not refresh on becoming visible when the data is still recent', async () => {
    const f = mockFetch({ '/api/aqi': () => json(makeAqi()) });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load());
    await act(() => vi.advanceTimersByTimeAsync(5 * MINUTE));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(countCalls(f, '/api/aqi')).toBe(1);
  });

  it('never auto-refreshes demo data or when disabled', async () => {
    const f = mockFetch({ '/api/aqi': () => json(makeAqi({ demo: true })) });
    const { result } = renderHook(() => useAqi());
    await act(() => result.current.load('X', true));
    await act(() => vi.advanceTimersByTimeAsync(60 * MINUTE));
    expect(countCalls(f, '/api/aqi')).toBe(1);

    const g = mockFetch({ '/api/aqi': () => json(makeAqi()) });
    const disabled = renderHook(() => useAqi({ refreshIntervalMs: 0 }));
    await act(() => disabled.result.current.load());
    await act(() => vi.advanceTimersByTimeAsync(60 * MINUTE));
    expect(countCalls(g, '/api/aqi')).toBe(1);
  });

  it('stops polling and removes listeners after unmount', async () => {
    const f = mockFetch({ '/api/aqi': () => json(makeAqi()) });
    const { result, unmount } = renderHook(() => useAqi());
    await act(() => result.current.load());
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60 * MINUTE));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(countCalls(f, '/api/aqi')).toBe(1);
  });
});

describe('useNow', () => {
  it('ticks on the interval and cleans up', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-24T08:00:00Z') });
    const { result, unmount } = renderHook(() => useNow(1000));
    const start = result.current;
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current - start).toBe(3000);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useFamilyProfiles', () => {
  it('uses on-device storage when the cloud is disabled and persists changes', async () => {
    mockFetch({ '/api/family': { enabled: false, items: [] } });
    const { result } = renderHook(() => useFamilyProfiles());
    await waitFor(() => expect(result.current.cloudEnabled).toBe(false));
    await act(() => result.current.addMember('Mia', 'child'));
    expect(result.current.members).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('aerosage_family'))[0]).toMatchObject({
      name: 'Mia',
      type: 'child',
    });
    act(() => result.current.removeMember(result.current.members[0].id));
    expect(result.current.members).toEqual([]);
  });

  it('uses the cloud when enabled, and keeps the member locally if saving fails', async () => {
    const saved = { id: 'srv-1', name: 'Asha', type: 'elderly' };
    const f = mockFetch({
      '/api/family': (url, init) => {
        if (init?.method === 'POST') return json({ error: 'down' }, 502);
        if (init?.method === 'DELETE') return json({ ok: true });
        return { enabled: true, items: [saved] };
      },
    });
    const { result } = renderHook(() => useFamilyProfiles());
    await waitFor(() => expect(result.current.cloudEnabled).toBe(true));
    expect(result.current.members).toEqual([saved]);
    await act(() => result.current.addMember('Local', 'adult'));
    expect(result.current.members.map((m) => m.name)).toEqual(['Asha', 'Local']);
    act(() => result.current.removeMember('srv-1'));
    expect(
      f.mock.calls.some(
        ([url, init]) => String(url).includes('/api/family/srv-1') && init.method === 'DELETE',
      ),
    ).toBe(true);
    // Cloud operations never write to on-device storage (only the pre-existing, empty local list was saved).
    expect(localStorage.getItem('aerosage_family')).toBe('[]');
  });

  it('saves a cloud-created member returned by the server', async () => {
    mockFetch({
      '/api/family': (url, init) =>
        init?.method === 'POST'
          ? json({ item: { id: 'new-1', name: 'Raj', type: 'worker' } }, 201)
          : { enabled: true, items: [] },
    });
    const { result } = renderHook(() => useFamilyProfiles());
    await waitFor(() => expect(result.current.cloudEnabled).toBe(true));
    await act(() => result.current.addMember('Raj', 'worker'));
    expect(result.current.members).toEqual([{ id: 'new-1', name: 'Raj', type: 'worker' }]);
  });

  it('survives the family endpoint being unreachable', async () => {
    mockFetch({
      '/api/family': () => {
        throw new TypeError('offline');
      },
    });
    const { result } = renderHook(() => useFamilyProfiles());
    await act(() => result.current.addMember('Mia', 'child'));
    expect(result.current.members).toHaveLength(1);
    expect(result.current.cloudEnabled).toBe(false);
  });
});

describe('useAssistantChat', () => {
  const context = { place: 'Kolkata', aqi: 232 };

  it('sends the message with context, history and profile, then records a labelled reply', async () => {
    const f = mockFetch({ '/api/chat': { text: 'Close windows.', ai: true, source: 'gemini' } });
    const { result } = renderHook(() =>
      useAssistantChat({ context, familyMembers: [{ name: 'Mia', type: 'child' }] }),
    );
    await act(() => result.current.send('  Is it safe?  '));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      message: 'Is it safe?',
      history: [],
      context,
      profile: [{ name: 'Mia', type: 'child' }],
    });
    expect(result.current.messages).toEqual([
      { role: 'user', text: 'Is it safe?' },
      { role: 'ai', text: 'Close windows.', source: 'gemini', note: undefined },
    ]);
    expect(result.current.busy).toBe(false);
  });

  it('includes only genuine Gemini replies as history on later turns', async () => {
    const f = mockFetch({
      '/api/chat': { text: 'fallback text', ai: false, source: 'fallback', note: 'busy' },
    });
    const { result } = renderHook(() => useAssistantChat({ context, familyMembers: [] }));
    await act(() => result.current.send('one'));
    await act(() => result.current.send('two'));
    expect(JSON.parse(f.mock.calls[1][1].body).history).toEqual([{ role: 'user', text: 'one' }]);
    expect(result.current.messages[1]).toMatchObject({ source: 'fallback', note: 'busy' });
  });

  it('records a friendly error message when the request fails', async () => {
    mockFetch({ '/api/chat': json({ error: 'Too many assistant messages.' }, 429) });
    const { result } = renderHook(() => useAssistantChat({ context, familyMembers: [] }));
    await act(() => result.current.send('hello'));
    expect(result.current.messages.at(-1)).toEqual({
      role: 'ai',
      text: 'Too many assistant messages.',
      source: 'error',
    });
  });

  it('ignores blank messages, missing context, and overlapping sends', async () => {
    let release;
    const f = mockFetch({
      '/api/chat': () =>
        new Promise((resolve) => {
          release = () => resolve(json({ text: 'ok', ai: true, source: 'gemini' }));
        }),
    });
    const { result } = renderHook(() => useAssistantChat({ context, familyMembers: [] }));
    await act(() => result.current.send('   '));
    expect(f).not.toHaveBeenCalled();
    let first;
    act(() => {
      first = result.current.send('first');
    });
    expect(result.current.busy).toBe(true);
    await act(() => result.current.send('second'));
    expect(f).toHaveBeenCalledTimes(1);
    release();
    await act(() => first);
    expect(result.current.messages.filter((m) => m.role === 'user')).toHaveLength(1);

    const noContext = renderHook(() => useAssistantChat({ context: null, familyMembers: [] }));
    await act(() => noContext.result.current.send('hello'));
    expect(f).toHaveBeenCalledTimes(1);
  });
});
