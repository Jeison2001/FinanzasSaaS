---
name: api-routes
description: Express route definitions in server/routes/. 4 route files mount 13 endpoints under /api. Auth routes are rate-limited and Zod-validated. Transaction, settings, and admin routes require JWT authentication via authMiddleware.
---

## Route Map
| File | Base Path | Methods | Auth | Rate Limited |
|---|---|---|---|---|
| `auth.routes.js` | `/api/auth` | POST login, register, forgot-password, reset-password | No | Yes (15/15min) |
| `transactions.routes.js` | `/api/transactions` | GET list, GET stats, GET reports, POST create, PUT :id, DELETE :id | JWT | No |
| `settings.routes.js` | `/api/settings` | GET, PUT | JWT | No |
| `admin.routes.js` | `/api/admin` | GET /users | JWT | No |

## Middleware Stack
1. `rateLimiter.middleware.js` — 15 req / 15 min window (auth routes only)
2. `authMiddleware.js` — JWT verify from `Authorization: Bearer` header
3. `validateMiddleware.js` — Zod schema validation on req.body

## Rules
- New routes: create file in `server/routes/`, mount in `server/index.js`.
- Always add Zod validation for POST/PUT bodies.
- Admin role check is done inside the controller, not in middleware.
