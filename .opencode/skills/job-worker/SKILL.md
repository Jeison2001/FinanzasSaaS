---
name: job-worker
description: Background job worker in server/services/jobWorker.service.js. Polling loop (5s interval) picks pending jobs from background_jobs table, locks them (5 min timeout), processes PROCESS_RECURRING type, deletes on success, retries up to 3x on failure.
---

## File
`server/services/jobWorker.service.js` (~89 lines)

## Architecture
- Polling interval: 5 seconds
- Lock mechanism: `locked_until` column set to NOW + 5 minutes
- Job types: `PROCESS_RECURRING` (only type currently)
- Max attempts: 3 — after 3 failures, job status set to `failed`
- On success: job is deleted from table

## Job Lifecycle
```
pending → locked (locked_until = now + 5min) → processing
  ├── success → DELETE from table
  └── failure → attempts++ → if attempts >= 3: status = 'failed'
                            → else: status = 'pending', locked_until = null
```

## Integration
- Started in `server/index.js` on boot via `jobWorker.start()`
- Jobs created by transaction controller when recurring transactions need processing
- Uses `server/db.js` client for all queries

## Rules
- New job types: add case in the switch inside `processJob()`.
- Never run multiple worker instances — no distributed lock mechanism.
