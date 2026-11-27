// Model timestamps from the API are LOCAL to the selected city (e.g. "2026-11-24T14:00") and carry
// no offset. They are read as plain text here, never via `new Date(text)`, so the viewer's own time
// zone cannot shift the city's hours.

/** Hour of day (0-23) from a local timestamp such as "2026-11-24T14:00". */
export const hourOf = (localTime) => Number(localTime.slice(11, 13));

const toUtcDate = (localTime) => new Date(`${localTime.slice(0, 16)}:00Z`);

const MODEL_TIME_FORMAT = {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
};
const CHART_LABEL_FORMAT = { timeZone: 'UTC', day: 'numeric', month: 'short', hour: 'numeric' };

/** "24 Nov, 2:15 pm" for a city-local timestamp, without any time-zone conversion. */
export const formatModelTime = (localTime) =>
  localTime ? toUtcDate(localTime).toLocaleString('en-IN', MODEL_TIME_FORMAT) : '';

export const formatChartLabel = (localTime) =>
  toUtcDate(localTime).toLocaleString('en-IN', CHART_LABEL_FORMAT);

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export const formatAge = (milliseconds) => {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

/** Age of an ISO timestamp relative to `nowMs`; Infinity when it cannot be parsed. */
export const ageMs = (isoTimestamp, nowMs) => {
  const parsed = Date.parse(isoTimestamp);
  return Number.isNaN(parsed) ? Infinity : nowMs - parsed;
};

export const formatClock = (isoTimestamp) =>
  new Date(isoTimestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
