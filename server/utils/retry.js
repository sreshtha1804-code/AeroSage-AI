const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Delay before retry number `attempt` (1-based): exponential growth, capped, with up to 20% jitter.
 * A server-provided hint (e.g. Retry-After) takes precedence but is still capped.
 */
export const backoffDelay = (
  attempt,
  { baseDelayMs, maxDelayMs, hintMs, random = Math.random },
) => {
  if (Number.isFinite(hintMs) && hintMs > 0) {
    return Math.min(hintMs, maxDelayMs);
  }
  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  return Math.round(exponential * (1 + 0.2 * random()));
};

/**
 * Run `attempt(n)` until it succeeds, a non-retryable outcome occurs, attempts run out,
 * or the next wait would exceed the time budget.
 *
 * `attempt` must never throw: it returns an outcome object with an `ok` flag.
 *
 * @template T
 * @param {(attemptNumber: number) => Promise<T & { ok: boolean }>} attempt
 * @param {object} options
 * @param {number} options.maxAttempts
 * @param {number} options.baseDelayMs
 * @param {number} options.maxDelayMs
 * @param {(outcome: T) => boolean} options.shouldRetry
 * @param {(outcome: T) => number | undefined} [options.getDelayHint]
 * @param {number} [options.budgetMs] Stop retrying when elapsed time plus the next delay exceeds this.
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.random]
 * @param {() => number} [options.now]
 * @returns {Promise<T & { ok: boolean }>}
 */
export async function withRetry(attempt, options) {
  const {
    shouldRetry,
    getDelayHint,
    budgetMs = Infinity,
    sleep = defaultSleep,
    random,
    now = Date.now,
  } = options;
  const maxAttempts = Math.max(1, options.maxAttempts);
  const startedAt = now();

  for (let number = 1; ; number++) {
    const outcome = await attempt(number);
    if (outcome.ok || !shouldRetry(outcome) || number >= maxAttempts) {
      return outcome;
    }
    const delay = backoffDelay(number, { ...options, hintMs: getDelayHint?.(outcome), random });
    if (now() - startedAt + delay > budgetMs) {
      return outcome;
    }
    await sleep(delay);
  }
}
