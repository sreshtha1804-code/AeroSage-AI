import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAqi } from '../../src/hooks/useAqi.js';
import { json, makeAqi } from './fixtures.js';

afterEach(() => vi.unstubAllGlobals());

describe('useAqi', () => {
  it('loads data and clears loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(makeAqi())),
    );
    const { result } = renderHook(() => useAqi('Kolkata'));
    await act(() => result.current.load());
    expect(result.current.data.place.name).toBe('Kolkata');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('rejects blank input without calling the network', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { result } = renderHook(() => useAqi('  '));
    await act(() => result.current.load());
    expect(f).not.toHaveBeenCalled();
    expect(result.current.error.message).toMatch(/city name/);
  });

  it('offers demo mode only when the server says so, or when unreachable', async () => {
    const { result } = renderHook(() => useAqi('X'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'Could not find "X".' }, 404)),
    );
    await act(() => result.current.load());
    expect(result.current.error).toEqual({ message: 'Could not find "X".', canDemo: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'down', canDemo: true }, 502)),
    );
    await act(() => result.current.load());
    expect(result.current.error.canDemo).toBe(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await act(() => result.current.load());
    expect(result.current.error.canDemo).toBe(true);
  });

  it('ignores a slow response that was superseded by a newer search', async () => {
    let resolveSlow;
    const slow = new Promise((r) => {
      resolveSlow = r;
    });
    const f = vi.fn((url, init) =>
      String(url).includes('Slow')
        ? slow.then(() =>
            init.signal.aborted
              ? Promise.reject(new DOMException('aborted', 'AbortError'))
              : json(makeAqi({ name: 'Slow' })),
          )
        : Promise.resolve(json(makeAqi({ name: 'Fast' }))),
    );
    vi.stubGlobal('fetch', f);
    const { result } = renderHook(() => useAqi('x'));
    let slowCall;
    act(() => {
      slowCall = result.current.load('Slow');
    });
    await act(() => result.current.load('Fast'));
    resolveSlow();
    await act(() => slowCall);
    await waitFor(() => expect(result.current.data.place.name).toBe('Fast'));
    expect(result.current.loading).toBe(false);
  });
});
