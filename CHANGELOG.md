# Changelog

## 3.0.0

### Environmental accuracy
- Full CPCB-style estimate: PM2.5, PM10, NO₂, SO₂, O₃ and CO sub-indices; 24-hour means and 8-hour running maxima; the 16-valid-hour coverage rule; the "at least one particulate" rule; dominant pollutant and sub-indices exposed.
- Provider units are read and converted (CO to mg/m³ for CPCB); unsupported units are rejected.
- Strict validation of geocoding and air-quality responses.
- City-local time handled as text; the planner no longer depends on the browser time zone.

### Transparency
- Provider, data type, city, model time (with time zone), retrieval time and AQI method are shown; the AQI is labelled an estimate and says how many pollutants it used.
- Observed (model) and forecast values are separated in chart, tables and text.

### Smart refresh
- 15-minute auto-refresh (visible tab only), manual refresh, stale indicators, request cancellation, server-side cache, in-flight de-duplication, geocode memory, and stale-while-error.
- Fixed: one click on the landing page sent two air-quality requests.

### Gemini
- Exponential backoff with jitter and `Retry-After`, a total time budget, richer prompt (scope, data rules, glossaries, answer style, safety), reply validation, and truncation flags.

### Security
- Redacting logger, `no-store` API responses, enforced CSP/HSTS on the frontend, extended prompt-context whitelisting.

### Code quality
- Backend split into domain / services / routes / middleware; single-purpose constants and config; frontend split into hooks and focused components with descriptive names.
- ESLint quality gates (complexity, depth, params, no-console, braces) and repository-invariant tests.

### Tooling
- Vite 6, Vitest 5; 0 `npm audit` findings.
