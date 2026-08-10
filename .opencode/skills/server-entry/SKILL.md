---
name: server-entry
description: Express server entrypoint at server/index.js. Configures compression, CORS, JSON parsing. Mounts 4 route groups. Runs daily CRON job for recurring transactions with cron_locks deduplication. Starts jobWorker on boot.
---

## File
`server/index.js` (~114 lines)

## Responsibilities
1. Express app setup (compression, CORS, JSON body parser)
2. Route mounting: auth, transactions, settings, admin under `/api`
3. CRON job: daily at midnight via `node-cron` — processes ALL recurring transactions
4. Job worker startup: `jobWorker.start()` on boot
5. Server listen on `process.env.PORT`

## Critical Warning
- **Duplicated recurrence logic**: `processAllRecurring()` in this file is nearly identical to `processUserRecurring()` in `transactions.controller.js`. Changes to one MUST be mirrored in the other.
- CRON uses `cron_locks` table to prevent duplicate daily runs.

## Middleware Order
1. `compression()`
2. `cors({ origin: ... })`
3. `express.json()`
4. Route handlers
