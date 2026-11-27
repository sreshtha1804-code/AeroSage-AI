/**
 * Small in-memory cache with a "fresh" and a longer "stale" lifetime.
 * Stale entries are never returned by `getFresh`; `getStale` lets callers fall back to the last
 * good value when a provider fails (and must label it as stale).
 */
export class TtlCache {
  /**
   * @param {{ freshMs: number, staleMs: number, maxEntries: number, now?: () => number }} options
   */
  constructor({ freshMs, staleMs, maxEntries, now = Date.now }) {
    this.freshMs = freshMs;
    this.staleMs = staleMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  get size() {
    return this.entries.size;
  }

  set(key, value) {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, { value, storedAt: this.now() });
  }

  getFresh(key) {
    const entry = this.entries.get(key);
    return entry && this.now() - entry.storedAt < this.freshMs ? entry.value : undefined;
  }

  /** @returns {{ value: unknown, ageMs: number } | undefined} */
  getStale(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    const ageMs = this.now() - entry.storedAt;
    if (ageMs >= this.staleMs) {
      this.entries.delete(key);
      return undefined;
    }
    return { value: entry.value, ageMs };
  }
}
