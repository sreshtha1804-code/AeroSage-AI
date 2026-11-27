import { describe, expect, it, vi } from 'vitest';
import { createGeminiClient } from '../../../server/services/gemini.js';
import { jsonResponse, silentLogger } from '../helpers.js';

const ok = (text = 'hello', finishReason = 'STOP') =>
  jsonResponse({ candidates: [{ content: { parts: [{ text }] }, finishReason }] });
const request = { systemInstruction: 'sys', contents: [{ role: 'user', parts: [{ text: 'hi' }] }] };

const make = (fetchImpl, extra = {}) =>
  createGeminiClient({
    fetchImpl,
    apiKey: 'test-key',
    model: 'm-1',
    logger: silentLogger(),
    sleep: vi.fn(async () => {}),
    random: () => 0,
    ...extra,
  });

describe('request construction', () => {
  it('sends the key only in a header, encodes the model, and includes generation config', async () => {
    const fetchImpl = vi.fn(async () => ok());
    await make(fetchImpl, { model: 'weird/model name' }).generate(request);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/models/weird%2Fmodel%20name:generateContent');
    expect(url).not.toContain('test-key');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(body.generationConfig).toEqual({ temperature: 0.7, maxOutputTokens: 2048 });
    expect(init.body).not.toContain('test-key');
  });
});

describe('success handling', () => {
  it('joins multi-part text and reports truncation on MAX_TOKENS', async () => {
    const multi = jsonResponse({
      candidates: [
        { content: { parts: [{ text: 'a ' }, { text: 'b' }, {}] }, finishReason: 'MAX_TOKENS' },
      ],
    });
    expect(await make(vi.fn(async () => multi)).generate(request)).toEqual({
      ok: true,
      text: 'a b',
      truncated: true,
    });
  });
});

describe('exponential backoff and retries', () => {
  it('waits 500ms, then 1000ms between three attempts on 503, then gives up', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    const outcome = await make(fetchImpl, { sleep }).generate(request);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000]);
    expect(outcome).toMatchObject({ ok: false, reason: 'http_error' });
  });

  it('recovers when a later attempt succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(ok('recovered'));
    expect(await make(fetchImpl).generate(request)).toMatchObject({ ok: true, text: 'recovered' });
  });

  it('uses Retry-After for 429 (capped at 4s by the retry policy)', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => jsonResponse({}, 429, { 'retry-after': '2' }));
    const outcome = await make(fetchImpl, { sleep }).generate(request);
    expect(outcome).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 2000]);
    const huge = vi.fn(async () => jsonResponse({}, 429, { 'retry-after': '600' }));
    const sleep2 = vi.fn(async () => {});
    await make(huge, { sleep: sleep2 }).generate(request);
    expect(sleep2.mock.calls[0][0]).toBe(4000);
  });

  it('ignores a malformed Retry-After header', async () => {
    const sleep = vi.fn(async () => {});
    await make(
      vi.fn(async () => jsonResponse({}, 429, { 'retry-after': 'soon' })),
      { sleep },
    ).generate(request);
    expect(sleep.mock.calls[0][0]).toBe(500);
  });

  it.each([400, 401, 403, 404])('does not retry HTTP %s', async (status) => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, status));
    expect(await make(fetchImpl).generate(request)).toMatchObject({
      ok: false,
      reason: 'http_error',
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries network errors and reports timeouts separately', async () => {
    const net = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await make(net).generate(request)).toMatchObject({ ok: false, reason: 'network' });
    expect(net).toHaveBeenCalledTimes(3);
    const slow = vi.fn(async () => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' });
    });
    expect(await make(slow).generate(request)).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('stops retrying when the total time budget would be exceeded', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    await make(fetchImpl, { budgetMs: 100 }).generate(request); // first wait (500ms) already exceeds 100ms
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('honours custom retry policies', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    await make(fetchImpl, {
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    }).generate(request);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('non-retryable model outcomes', () => {
  it('reports blocked prompts and empty replies without retrying', async () => {
    const blocked = vi.fn(async () => jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }));
    expect(await make(blocked).generate(request)).toMatchObject({ ok: false, reason: 'blocked' });
    expect(blocked).toHaveBeenCalledTimes(1);
    const empty = vi.fn(async () => jsonResponse({ candidates: [{ finishReason: 'STOP' }] }));
    expect(await make(empty).generate(request)).toMatchObject({ ok: false, reason: 'empty' });
    expect(empty).toHaveBeenCalledTimes(1);
  });

  it('tolerates a response body that is not JSON', async () => {
    const bad = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => {
        throw new Error('x');
      },
    }));
    expect(await make(bad).generate(request)).toMatchObject({ ok: false, reason: 'empty' });
  });
});

describe('logging hygiene', () => {
  it('never logs the key or the prompt', async () => {
    const logger = silentLogger();
    await make(
      vi.fn(async () => jsonResponse({ error: { message: 'bad key test-key' } }, 500)),
      { logger },
    ).generate(request);
    const logged = JSON.stringify([...logger.error.mock.calls, ...logger.warn.mock.calls]);
    expect(logged).not.toContain('test-key');
    expect(logged).not.toContain('sys');
  });
});
