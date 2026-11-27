/** Frontend tunables, kept in one place. */

const MINUTE = 60 * 1000;

/** How often the dashboard re-checks for newer data while the tab is visible. */
export const REFRESH_INTERVAL_MS = 15 * MINUTE;

/** A reading older than this is labelled "stale". */
export const STALE_AFTER_MS = 30 * MINUTE;

/** How often relative times ("5 min ago") and staleness are re-evaluated. */
export const CLOCK_TICK_MS = MINUTE;

export const DEFAULT_CITY = 'Kolkata';
export const MAX_CITY_LENGTH = 80;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_PROFILE_NAME_LENGTH = 40;

/** Hours considered sensible for outdoor activity when suggesting the cleanest windows. */
export const OUTDOOR_HOURS = Object.freeze({ from: 5, to: 21 });
export const BEST_HOURS_COUNT = 3;
export const FORECAST_WINDOW_HOURS = 24;

export const API_TIMEOUT_MS = 20 * 1000;
export const CHAT_TIMEOUT_MS = 60 * 1000;
