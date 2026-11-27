/** Errors with a stable `code` so routes can map them to HTTP responses without string matching. */

export class UpstreamError extends Error {
  /**
   * @param {'timeout'|'network'|'http'|'invalid_response'} code
   * @param {string} message
   * @param {{ status?: number }} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.code = code;
    this.status = details.status;
  }

  /** Transient failures worth retrying (never client-side 4xx errors, never malformed payloads). */
  get isRetryable() {
    if (this.code === 'timeout' || this.code === 'network') {
      return true;
    }
    return this.code === 'http' && (this.status === 429 || this.status >= 500);
  }
}

export class CityNotFoundError extends Error {
  constructor(city) {
    super(`Could not find "${city}".`);
    this.name = 'CityNotFoundError';
    this.city = city;
  }
}
