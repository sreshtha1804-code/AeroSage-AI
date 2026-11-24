import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  createFamilyMember,
  deleteFamilyMember,
  errorMessage,
  fetchAqi,
  getFamily,
  sendChat,
} from '../../src/lib/api.js';
import { getDeviceId, loadFamily, saveFamily, uid } from '../../src/lib/storage.js';
import { json } from './fixtures.js';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('api client', () => {
  it('encodes the city and adds demo flag', async () => {
    const f = vi.fn(async () => json({ ok: 1 }));
    vi.stubGlobal('fetch', f);
    await fetchAqi('New Delhi & co', { demo: true });
    expect(f.mock.calls[0][0]).toBe('/api/aqi?city=New%20Delhi%20%26%20co&demo=1');
  });

  it('throws ApiError with the server body on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'Nope', canDemo: true }, 502)),
    );
    const err = await fetchAqi('x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.body.canDemo).toBe(true);
    expect(errorMessage(err)).toBe('Nope');
  });

  it('sends JSON for POST/DELETE helpers', async () => {
    const f = vi.fn(async () => json({}));
    vi.stubGlobal('fetch', f);
    await sendChat({ message: 'hi' });
    await createFamilyMember({ device: 'd', name: 'n', type: 'child' });
    await deleteFamilyMember('id 1', 'dev');
    await getFamily('dev');
    expect(f.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{"message":"hi"}' });
    expect(f.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(f.mock.calls[2][0]).toBe('/api/family/id%201?device=dev');
    expect(f.mock.calls[2][1].method).toBe('DELETE');
    expect(f.mock.calls[3][0]).toBe('/api/family?device=dev');
  });

  it('tolerates a non-JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('x');
        },
      })),
    );
    const err = await fetchAqi('x').catch((e) => e);
    expect(err.message).toBe('Request failed');
  });

  it('maps network errors and timeouts to friendly messages', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/Cannot reach the server/);
    expect(errorMessage(Object.assign(new Error('t'), { name: 'TimeoutError' }))).toMatch(
      /too long/,
    );
  });
});

describe('storage', () => {
  it('creates and reuses a device id', () => {
    const first = getDeviceId();
    expect(first).toMatch(/\S{10,}/);
    expect(getDeviceId()).toBe(first);
    expect(uid()).not.toBe(uid());
  });
  it('round-trips family profiles and survives corrupt data', () => {
    saveFamily([{ id: '1', name: 'Mia', type: 'child' }]);
    expect(loadFamily()).toEqual([{ id: '1', name: 'Mia', type: 'child' }]);
    localStorage.setItem('aerosage_family', '{not json');
    expect(loadFamily()).toEqual([]);
    localStorage.setItem('aerosage_family', '{"a":1}');
    expect(loadFamily()).toEqual([]);
  });
  it('works when localStorage throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getDeviceId()).toBeTruthy();
    expect(loadFamily()).toEqual([]);
    expect(() => saveFamily([])).not.toThrow();
    vi.restoreAllMocks();
  });
});
