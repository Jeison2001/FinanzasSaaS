---
name: server-entry
description: Express server entrypoint at server/index.js. Configures trust proxy, security headers, compression, CORS, JSON parsing (600kb). Mounts 6 route groups. Runs hourly CRON with per-user timezone for recurring transactions (cron_locks deduplication). Fail-fast on missing PORT/JWT_SECRET.
---

## File
`server/index.js`

## Responsibilities
1. Express app setup: `trust proxy 1` (rate limiter tras proxy), security headers (nosniff, X-Frame-Options, Referrer-Policy), compression, CORS (allowlist + vercel.app), `express.json({ limit: '600kb' })`
2. Route mounting under `/api`: auth, transactions, settings, admin, notifications, budgets
3. CRON horario (`0 * * * *`): lock `cron_<fecha>_<hora>`; calcula el "hoy" de cada usuario con su timezone (`user_settings.timezone` → `todayInTimeZone`) y llama `processRecurringTransactions(userId, userToday)`
4. Fail-fast: `PORT` y `JWT_SECRET` obligatorios; locks huérfanos de recurrencia limpiados al arranque
5. Server listen on `process.env.PORT`

## Critical Warning
- La lógica de recurrencia es UNIFICADA en `server/services/recurrence.service.js` — este archivo solo la invoca. Prohibido duplicarla.
- Confirmar una transacción `overdue` NO genera ocurrencia (el CRON ya la creó); solo una `planned` la genera al confirmarse (ver `transactions.controller.js`).

## Middleware Order
1. `trust proxy`
2. `compression()`
3. Security headers middleware
4. `cors({ origin: ... })`
5. `express.json({ limit: '600kb' })`
6. Route handlers
