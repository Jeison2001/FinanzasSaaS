---
name: db-schema
description: Database schema definition for FinanzasSaaS. 6 tables (users, transactions, user_settings, password_reset_tokens, cron_locks, background_jobs) defined via raw SQL in server/db.js. No ORM, no migrations framework. Schema is idempotent (CREATE TABLE IF NOT EXISTS). Turso/libSQL client.
---

## Canonical Source
`server/db.js` — single source of truth for all table definitions.

## Tables
| Table | Primary Key | Foreign Keys | Purpose |
|---|---|---|---|
| `users` | `id` (uuid) | — | Auth: email, password_hash, role (admin/client) |
| `transactions` | `id` (uuid) | `user_id → users.id` | Core: type, category, amount, description, date, status, recurrence |
| `user_settings` | `user_id` | `user_id → users.id` | Prefs: savings_goal, currency, language |
| `password_reset_tokens` | `token` | `user_id → users.id` | 1-hour expiry tokens for password reset |
| `cron_locks` | `id` | — | Deduplication for daily recurring CRON |
| `background_jobs` | `id` (uuid) | — | Job queue: type, payload, status, attempts, locked_until |

## Modification Rules
- Any column change MUST be done in `server/db.js` `initDB()`.
- No migration system exists — schema changes are destructive unless handled with ALTER TABLE.
- Always verify FK constraints manually.
- After schema change, restart server to re-run `initDB()`.
