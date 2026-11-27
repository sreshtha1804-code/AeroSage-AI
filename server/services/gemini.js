import { GEMINI, RETRY_POLICIES, TIMEOUTS_MS } from '../constants.js';
import { withRetry } from '../utils/retry.js';

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const retryAfterMs = (response) => {
  const seconds = Number(response.headers?.get?.('retry-after'));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, GEMINI.maxRetryAfterMs)
    : undefined;
};

/**
 * @typedef {{ ok: true, text: string, truncated: boolean }
 *   | { ok: false, reason: 'rate_limited'|'http_error'|'blocked'|'empty'|'timeout'|'network', retryable?: boolean }} GeminiOutcome
 */

/**
 * Gemini client with bounded retries, exponential backoff, per-request timeout and a total time budget.
 * Never throws: failures are returned as `{ ok: false, reason }` so callers can fall back safely.
 * The API key is only ever sent in a header, never in the URL, and is never logged.
 */
export function createGeminiClient({
  fetchImpl,
  apiKey,
  model,
  logger,
  sleep,
  random,
  retryPolicy = RETRY_POLICIES.gemini,
  timeoutMs = TIMEOUTS_MS.gemini,
  budgetMs = TIMEOUTS_MS.geminiTotalBudget,
}) {
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;

  /** Turn an HTTP response into an outcome object (success, or a classified failure). */
  const interpretResponse = (response, data) => {
    if (!response.ok) {
      logger.error('[Gemini] HTTP error', { status: response.status });
      return {
        ok: false,
        reason: response.status === 429 ? 'rate_limited' : 'http_error',
        retryable: RETRYABLE_STATUSES.has(response.status),
        retryAfterMs: retryAfterMs(response),
      };
    }
    if (data?.promptFeedback?.blockReason) {
      logger.error('[Gemini] prompt blocked', { blockReason: data.promptFeedback.blockReason });
      return { ok: false, reason: 'blocked', retryable: false };
    }
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part?.text || '')
      .join('')
      .trim();
    if (!text) {
      logger.error('[Gemini] empty response', { finishReason: candidate?.finishReason });
      return { ok: false, reason: 'empty', retryable: false };
    }
    return { ok: true, text, truncated: candidate?.finishReason === 'MAX_TOKENS' };
  };

  /** One HTTP attempt. Network failures and timeouts become retryable outcomes instead of exceptions. */
  const attemptOnce = async (body) => {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return interpretResponse(response, await response.json().catch(() => ({})));
    } catch (error) {
      logger.error('[Gemini] request failed', { name: error.name });
      return {
        ok: false,
        reason: error.name === 'TimeoutError' ? 'timeout' : 'network',
        retryable: true,
      };
    }
  };

  return {
    /**
     * @param {{ systemInstruction: string, contents: object[] }} request
     * @returns {Promise<GeminiOutcome>}
     */
    generate({ systemInstruction, contents }) {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: GEMINI.temperature,
          maxOutputTokens: GEMINI.maxOutputTokens,
        },
      });
      return withRetry(() => attemptOnce(body), {
        ...retryPolicy,
        budgetMs,
        sleep,
        random,
        shouldRetry: (outcome) => outcome.retryable === true,
        getDelayHint: (outcome) => outcome.retryAfterMs,
      });
    },
  };
}
