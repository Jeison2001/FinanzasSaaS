---
name: controllers
description: Express REST API controllers in server/controllers/. 5 controllers handle auth, password reset, transactions (CRUD + stats + reports + recurring), settings, and admin. transactions.controller.js is the densest file (268 lines) with complex SQL aggregation and recurring chain logic.
---

## Files
| Controller | Path | Lines | Endpoints |
|---|---|---|---|
| `auth` | `server/controllers/auth.controller.js` | ~50 | register(), login() |
| `password` | `server/controllers/password.controller.js` | ~91 | forgotPassword(), resetPassword() |
| `transactions` | `server/controllers/transactions.controller.js` | ~268 | processUserRecurring(), getTransactions(), getStats(), getReports(), createTransaction(), updateTransaction(), deleteTransaction() |
| `settings` | `server/controllers/settings.controller.js` | ~30 | getSettings(), updateSettings() |
| `admin` | `server/controllers/admin.controller.js` | ~25 | getUsers() |

## Key Patterns
- All controllers use `db.execute()` with raw SQL parameterized queries.
- Auth: bcrypt hashing, JWT signing with 365-day expiry.
- Transactions: Dynamic SQL filters for month/year/dateRange in reports.
- Recurring logic is duplicated in `server/index.js` CRON — keep synchronized.
- Error handling: try/catch with `res.status(500).json({ error })`.
