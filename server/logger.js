/* eslint-no-console is disabled in this file only: it is the single place that writes logs. */

const LEVELS = ['error', 'warn', 'info', 'debug'];
const SENSITIVE_KEY = /key|token|secret|authorization|password|cookie/i;
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];
const REDACTED = '[REDACTED]';

/** Replace known secrets and secret-looking values so they can never reach the logs. */
export const redact = (value, secrets = [], depth = 0) => {
  if (depth > 4) {
    return '[Truncated]';
  }
  if (typeof value === 'string') {
    let clean = value;
    for (const secret of secrets) {
      if (secret) {
        clean = clean.split(secret).join(REDACTED);
      }
    }
    for (const pattern of SECRET_PATTERNS) {
      clean = clean.replace(pattern, REDACTED);
    }
    return clean;
  }
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message, secrets, depth + 1) };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, secrets, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redact(item, secrets, depth + 1),
      ]),
    );
  }
  return value;
};

/**
 * @param {{ level?: 'error'|'warn'|'info'|'debug', secrets?: string[], sink?: Console }} [options]
 */
export function createLogger({ level = 'info', secrets = [], sink = console } = {}) {
  const threshold = LEVELS.indexOf(level);
  const write = (name) => (message, meta) => {
    if (LEVELS.indexOf(name) > threshold) {
      return;
    }
    const line = redact(String(message), secrets);
    if (meta === undefined) {
      sink[name === 'debug' ? 'log' : name](line);
    } else {
      sink[name === 'debug' ? 'log' : name](line, redact(meta, secrets));
    }
  };
  return Object.fromEntries(LEVELS.map((name) => [name, write(name)]));
}
