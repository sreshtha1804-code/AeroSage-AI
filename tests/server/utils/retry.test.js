import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, withRetry } from '../../../server/utils/retry.js';

const policy = { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 1000 };

describe('backoffDelay (exponential with jitter)', () => {
  it('doubles each attempt and is capped', () => {
    const delays = [1, 2, 3, 4, 5].map((n) =>
      backoffDelay(n, { baseDelayMs: 100, maxDelayMs: 500, random: () => 0 }),
    );
    expect(delays).toEqual([100, 200, 400, 500, 500]);
  });
  it('adds up to 20% jitter', () => {
    expect(backoffDelay(1, { baseDelayMs: 100, maxDelayMs: 500, random: () => 1 })).toBe(120);
  });
  it('prefers a server hint but still caps it', () => {
    expect(backoffDelay(1, { baseDelayMs: 100, maxDelayMs: 500, hintMs: 300 })).toBe(300);
    expect(backoffDelay(1, { baseDelayMs: 100, maxDelayMs: 500, hintMs: 9000 })).toBe(500);
  });
});

describe('withRetry', () => {
  it('returns immediately on success without sleeping', async () => {
    const sleep = vi.fn();
    const result = await withRetry(async () => ({ ok: true, value: 1 }), {
      ...policy,
      sleep,
      shouldRetry: () => true,
    });
    expect(result).toEqual({ ok: true, value: 1 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries retryable failures with exponentially growing waits, then succeeds', async () => {
    const sleep = vi.fn(async () => {});
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    const result = await withRetry(attempt, {
      ...policy,
      sleep,
      random: () => 0,
      shouldRetry: () => true,
    });
    expect(result.ok).toBe(true);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
  });

  it('stops at maxAttempts and returns the last failure', async () => {
    const attempt = vi.fn(async (n) => ({ ok: false, n }));
    const result = await withRetry(attempt, {
      ...policy,
      sleep: async () => {},
      shouldRetry: () => true,
    });
    expect(attempt).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ ok: false, n: 4 });
  });

  it('does not retry non-retryable outcomes', async () => {
    const attempt = vi.fn(async () => ({ ok: false, retryable: false }));
    await withRetry(attempt, { ...policy, sleep: async () => {}, shouldRetry: (o) => o.retryable });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('gives up when the next wait would exceed the time budget', async () => {
    let clock = 0;
    const attempt = vi.fn(async () => {
      clock += 950;
      return { ok: false };
    });
    await withRetry(attempt, {
      ...policy,
      budgetMs: 1000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      random: () => 0,
      shouldRetry: () => true,
    });
    expect(attempt).toHaveBeenCalledTimes(1); // 950 elapsed + 100 wait > 1000 budget
  });

  it('uses getDelayHint (e.g. Retry-After)', async () => {
    const sleep = vi.fn(async () => {});
    await withRetry(
      vi.fn().mockResolvedValueOnce({ ok: false, hint: 450 }).mockResolvedValueOnce({ ok: true }),
      {
        ...policy,
        sleep,
        shouldRetry: () => true,
        getDelayHint: (o) => o.hint,
      },
    );
    expect(sleep).toHaveBeenCalledWith(450);
  });

  it('works with the real timer when no sleep is injected', async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    const result = await withRetry(attempt, {
      maxAttempts: 2,
      baseDelayMs: 1,
      maxDelayMs: 2,
      shouldRetry: () => true,
    });
    expect(result.ok).toBe(true);
  });
});
