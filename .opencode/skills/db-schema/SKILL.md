---
name: db-schema
description: Database schema definition for FinanzasSaaS. 7 tables (users, transactions, user_settings, budgets, password_reset_tokens, cron_locks, user_notifications) defined via raw SQL in server/db.js. No ORM, no migrations framework. Schema is idempotent (CREATE TABLE IF NOT EXISTS + ALTER TABLE idempotente). Turso/libSQL client.
---

## Canonical Source
`server/db.js` — single source of truth for all table definitions.

## Tables
| Table | Primary Key | Foreign Keys | Purpose |
|---|---|---|---|
| `users` | `id` (uuid) | — | Auth: email, password_hash, role (admin/client), pwd_version (invalida JWT tras reset) |
| `transactions` | `id` (uuid) | `user_id → users.id` | Core: type, category, amount_cents (INTEGER, única fuente de dinero), description + description_norm (búsqueda sin acentos), date, status (planned/overdue/completed), recurrence, series_id (ancla de serie) |
| `user_settings` | `user_id` | `user_id → users.id` | Prefs: savings_goal, currency (fijada en registro), language, timezone (IANA, para el CRON) |
| `budgets` | `id` (uuid) | `user_id → users.id` | Presupuesto mensual por categoría: UNIQUE(user_id, category, month, year) |
| `password_reset_tokens` | `token` | `user_id → users.id` | 1-hour expiry tokens for password reset |
| `cron_locks` | `id` | — | Deduplicación del CRON horario (`cron_<fecha>_<hora>`) y locks de recurrencia por usuario |
| `user_notifications` | `id` (uuid) | `user_id → users.id` | Notificaciones in-app: type, message_key (i18n), is_read |

## Columnas derivadas (no físicas)
- `amount` NO existe físicamente: se deriva en las queries de lectura como `amount_cents / 100.0 AS amount`. Nunca escribas ni filtres por un `amount` físico.

## Modification Rules
- Any column change MUST be done in `server/db.js` `initDB()`.
- No migration system exists — cambios no destructivos via `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` en try/catch idempotente (ej: series_id, description_norm, amount_cents, pwd_version, timezone).
- Siempre parametrizar queries (`args`) — nunca interpolar valores.
- After schema change, restart server to re-run `initDB()`.
