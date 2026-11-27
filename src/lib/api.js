import { API_TIMEOUT_MS, CHAT_TIMEOUT_MS } from '../constants.js';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Error carrying the server's JSON body (e.g. `{ error, canDemo }`). */
export class ApiError extends Error {
  constructor(body, status) {
    super(body?.error || 'Request failed');
    this.body = body;
    this.status = status;
  }
}

/** Abort when any of the signals fires (AbortSignal.any is missing in older browsers). */
const anySignal = (signals) => {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
  }
  return controller.signal;
};

const timeoutSignal = (ms) =>
  typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : new AbortController().signal;

const request = async (path, { method = 'GET', body, signal, timeoutMs = API_TIMEOUT_MS } = {}) => {
  const timeout = timeoutSignal(timeoutMs);
  const response = await fetch(API_BASE_URL + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? anySignal([signal, timeout]) : timeout,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data, response.status);
  }
  return data;
};

export const fetchAirQuality = (city, { demo = false, signal } = {}) =>
  request(`/api/aqi?city=${encodeURIComponent(city)}${demo ? '&demo=1' : ''}`, { signal });

// The assistant may retry on the server, so allow a longer client timeout.
export const sendChat = (payload) =>
  request('/api/chat', { method: 'POST', body: payload, timeoutMs: CHAT_TIMEOUT_MS });

export const getFamily = (deviceId) =>
  request(`/api/family?device=${encodeURIComponent(deviceId)}`);
export const createFamilyMember = (payload) =>
  request('/api/family', { method: 'POST', body: payload });
export const deleteFamilyMember = (id, deviceId) =>
  request(`/api/family/${encodeURIComponent(id)}?device=${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  });

/** Human-readable message for any error thrown by the helpers above. */
export const errorMessage = (error) => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error?.name === 'TimeoutError') {
    return 'The server took too long to respond. Please try again.';
  }
  return 'Cannot reach the server. Please check your connection and try again.';
};
