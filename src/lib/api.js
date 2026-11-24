const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Error carrying the server's JSON body (e.g. { error, canDemo }). */
export class ApiError extends Error {
  constructor(body, status) {
    super(body?.error || 'Request failed');
    this.body = body;
    this.status = status;
  }
}

/** Abort when either signal fires (AbortSignal.any is missing in older browsers). */
const anySignal = (signals) => {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) controller.abort(s.reason);
    else s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
};

const request = async (path, { method = 'GET', body, signal, timeoutMs = 20000 } = {}) => {
  const timeout =
    typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : new AbortController().signal;
  const response = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? anySignal([signal, timeout]) : timeout,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data, response.status);
  return data;
};

export const fetchAqi = (city, { demo = false, signal } = {}) =>
  request(`/api/aqi?city=${encodeURIComponent(city)}${demo ? '&demo=1' : ''}`, { signal });

// The assistant may retry on the server, so allow a longer client timeout.
export const sendChat = (payload) =>
  request('/api/chat', { method: 'POST', body: payload, timeoutMs: 60000 });

export const getFamily = (device) => request(`/api/family?device=${encodeURIComponent(device)}`);
export const createFamilyMember = (payload) =>
  request('/api/family', { method: 'POST', body: payload });
export const deleteFamilyMember = (id, device) =>
  request(`/api/family/${encodeURIComponent(id)}?device=${encodeURIComponent(device)}`, {
    method: 'DELETE',
  });

/** Human-readable message for any error thrown by the helpers above. */
export const errorMessage = (error) =>
  error instanceof ApiError
    ? error.message
    : error?.name === 'TimeoutError'
      ? 'The server took too long to respond. Please try again.'
      : 'Cannot reach the server. Please check your connection and try again.';
