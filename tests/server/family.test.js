import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, startApp } from './helpers.js';

let ctx;
afterEach(async () => ctx && (await ctx.close()));

const DEVICE = '123e4567-e89b-12d3-a456-426614174000';
const ID = '223e4567-e89b-12d3-a456-426614174001';
const env = { SUPABASE_URL: 'https://proj.supabase.co/', SUPABASE_SERVICE_KEY: 'service-secret' };

describe('family API when Supabase is not configured', () => {
  it('GET reports disabled, POST/DELETE return 503', async () => {
    ctx = await startApp();
    expect(await (await ctx.request(`/api/family?device=${DEVICE}`)).json()).toEqual({
      enabled: false,
      items: [],
    });
    expect(
      (await ctx.post('/api/family', { device: DEVICE, name: 'A', type: 'child' })).status,
    ).toBe(503);
    expect(
      (await ctx.request(`/api/family/${ID}?device=${DEVICE}`, { method: 'DELETE' })).status,
    ).toBe(503);
  });
});

describe('GET /api/family', () => {
  it('rejects invalid device IDs (including filter-injection attempts)', async () => {
    const fetchImpl = vi.fn();
    ctx = await startApp({ env, fetchImpl });
    for (const device of ['', 'abc', `${DEVICE}&select=*`, 'a'.repeat(36)]) {
      expect((await ctx.request(`/api/family?device=${encodeURIComponent(device)}`)).status).toBe(
        400,
      );
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns items and uses the service key only server-side', async () => {
    const items = [{ id: ID, name: 'Mia', type: 'child' }];
    const fetchImpl = vi.fn(async () => jsonResponse(items));
    ctx = await startApp({ env, fetchImpl });
    const res = await ctx.request(`/api/family?device=${DEVICE}`);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ enabled: true, items });
    expect(text).not.toContain('service-secret');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      `https://proj.supabase.co/rest/v1/profiles?device_id=eq.${DEVICE}&select=id,name,type&order=created_at`,
    );
    expect(init.headers.apikey).toBe('service-secret');
  });

  it('degrades to disabled (local storage) when Supabase fails', async () => {
    ctx = await startApp({ env, fetchImpl: vi.fn(async () => jsonResponse({}, 500)) });
    expect(await (await ctx.request(`/api/family?device=${DEVICE}`)).json()).toEqual({
      enabled: false,
      items: [],
    });
  });
});

describe('POST /api/family', () => {
  it.each([
    [{ device: 'bad', name: 'A', type: 'child' }],
    [{ device: DEVICE, name: 'A', type: 'robot' }],
    [{ device: DEVICE, name: '   ', type: 'child' }],
    [{ device: DEVICE, name: 42, type: 'child' }],
    [{}],
  ])('400 for invalid input %j', async (body) => {
    ctx = await startApp({ env, fetchImpl: vi.fn() });
    expect((await ctx.post('/api/family', body)).status).toBe(400);
  });

  it('creates a profile with a cleaned, truncated name', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([{ id: ID, name: 'Mia', type: 'child', device_id: DEVICE }], 201),
      );
    ctx = await startApp({ env, fetchImpl });
    const res = await ctx.post('/api/family', {
      device: DEVICE,
      name: `  Mia\n${'x'.repeat(100)}`,
      type: 'child',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ item: { id: ID, name: 'Mia', type: 'child' } });
    const saved = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(saved.name).toHaveLength(40);
    expect(saved.name.startsWith('Mia x')).toBe(true);
  });

  it('enforces the per-device profile limit with 409', async () => {
    const full = Array.from({ length: 20 }, (_, i) => ({ id: String(i) }));
    const fetchImpl = vi.fn(async () => jsonResponse(full));
    ctx = await startApp({ env, fetchImpl });
    const res = await ctx.post('/api/family', { device: DEVICE, name: 'A', type: 'adult' });
    expect(res.status).toBe(409);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('502 with a generic error when Supabase fails (no internals leaked)', async () => {
    ctx = await startApp({
      env,
      fetchImpl: vi.fn(async () => jsonResponse({ message: 'secret db detail' }, 500)),
    });
    const res = await ctx.post('/api/family', { device: DEVICE, name: 'A', type: 'adult' });
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain('secret db detail');
  });
});

describe('DELETE /api/family/:id', () => {
  it('400 for invalid ids', async () => {
    ctx = await startApp({ env, fetchImpl: vi.fn() });
    expect(
      (await ctx.request(`/api/family/nope?device=${DEVICE}`, { method: 'DELETE' })).status,
    ).toBe(400);
    expect((await ctx.request(`/api/family/${ID}?device=nope`, { method: 'DELETE' })).status).toBe(
      400,
    );
  });

  it('scopes deletion to the device and returns ok', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ id: ID }]));
    ctx = await startApp({ env, fetchImpl });
    const res = await ctx.request(`/api/family/${ID}?device=${DEVICE}`, { method: 'DELETE' });
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchImpl.mock.calls[0][0]).toContain(`profiles?id=eq.${ID}&device_id=eq.${DEVICE}`);
    expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE');
  });

  it('404 when nothing matched, 502 on Supabase failure', async () => {
    ctx = await startApp({ env, fetchImpl: vi.fn(async () => jsonResponse([])) });
    expect(
      (await ctx.request(`/api/family/${ID}?device=${DEVICE}`, { method: 'DELETE' })).status,
    ).toBe(404);
    await ctx.close();
    ctx = await startApp({ env, fetchImpl: vi.fn(async () => jsonResponse({}, 500)) });
    expect(
      (await ctx.request(`/api/family/${ID}?device=${DEVICE}`, { method: 'DELETE' })).status,
    ).toBe(502);
  });
});
