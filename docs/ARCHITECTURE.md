# AeroSage AI – Architecture

## Layers

| Layer | Folder | Responsibility | Depends on |
| ----- | ------ | -------------- | ---------- |
| Domain | `server/domain` | Pure logic: CPCB maths (`aqi`), units, provider-response parsing/validation, payload building, assistant prompt/fallback/reply validation, demo data. No I/O. | constants, errors |
| Services | `server/services` | I/O and policies: Open-Meteo client (timeouts, retries), air-quality service (cache, in-flight de-duplication, stale-while-error), Gemini client (backoff, budget), Supabase profile store. | domain, utils |
| Routes | `server/routes` | HTTP only: validate input, call a service, map errors to status codes. | services, domain |
| Middleware | `server/middleware` | Security (helmet, CORS, body limit, rate limiters), `no-store`, JSON error handlers. | — |
| Composition | `server/app.js` | Wires config, services and routes. Every external dependency (fetch, logger, clock, env) is injectable. | all |
| Entry | `server/index.js` | Reads config, creates the logger, listens. | app |

Cross-cutting: `constants.js` (every tunable number), `config.js` (all environment access), `errors.js` (typed errors), `logger.js` (the only place that writes logs; redacts secrets), `utils/` (`withRetry`, `TtlCache`, request sanitisers).

## Frontend

`App.jsx` owns navigation (a page registry), focus management and the live region. State lives in hooks: `useAqi` (loading, auto/manual refresh, stale tracking, cancellation), `useAssistantChat` (conversation, kept across tabs), `useFamilyProfiles` (cloud or on-device). Components are presentational; pure logic lives in `src/lib` (AQI categories and advice, city-local time handling, API client, chat/context builders, calculators). Recharts is loaded lazily.

## Key decisions

- **Estimates, not measurements.** Inputs are CAMS model values, so the AQI is always labelled an estimate, and forecasts are kept apart from model values for past/current hours in data, charts and text.
- **City-local time as text.** Provider timestamps carry no offset; they are read as text, never via `new Date(text)`, so the viewer's time zone (or a DST change) cannot shift the city's hours.
- **Stale over silent failure.** When the provider fails, the last good reading is served and flagged `stale`; the UI keeps showing it with a visible label.
- **Fallback is never AI.** Every chat reply has a `source`; rule-based guidance says it is not AI-generated.
- **Dependency injection for testability.** No test needs a network, a key or a real clock.
- **Quality gates in tooling.** ESLint enforces complexity ≤ 15, nesting ≤ 4, no `console` outside the logger, braces everywhere, and the `jsx-a11y` rules; `tests/repo` pins security, deployment and accessibility configuration invariants.
