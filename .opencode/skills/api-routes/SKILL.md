---
name: api-routes
description: Express route definitions in server/routes/. 10 route files mount 34 endpoints under /api. Auth routes are rate-limited (authLimiter, 15/15min) and Zod-validated; import CSV additionally uses importLimiter (30/min). All routes except /api/auth require JWT via authenticateToken.
---

## Files (server/routes/)
| Archivo | Montaje | Endpoints |
|---|---|---|
| `auth.routes.js` | `/api/auth` | POST register · login · forgot-password · reset-password (los 4 con authLimiter; reset-password también) |
| `transactions.routes.js` | `/api/transactions` | GET stats · reports · export · '' (listado filtrado) · POST confirm-overdue · import · '' · PUT :id · DELETE :id |
| `budgets.routes.js` | `/api/budgets` | GET '' (mes/año) · PUT '' (reemplazo transaccional) |
| `settings.routes.js` | `/api/settings` | GET '' · PUT '' (timezone incluida, COALESCE) |
| `admin.routes.js` | `/api/admin` | GET users · POST users/:userId/reset (transaccional, borra budgets) |
| `notifications.routes.js` | `/api/notifications` | GET '' · PUT :id/read |
| `accounts.routes.js` · `cards.routes.js` · `loans.routes.js` | `/api/accounts` · `/api/cards` · `/api/loans` | CRUD completo; DELETE en cascada de movimientos vinculados |
| `overview.routes.js` | `/api/overview` | GET patrimonio neto + saldos derivados |

## Orden de middleware
1. Global (index.js): trust proxy → security headers → CORS → `express.json({ limit: '600kb' })`
2. Por ruta: `authenticateToken` (via router.use) → limiters opcionales → `validate(schemaZod)` → controller

## Reglas
- Rutas específicas ANTES de paramétricas (`/stats`, `/export`, `/confirm-overdue`, `/import` antes de `/:id`).
- `importLimiter` en import: parse CPU de hasta 600KB — sin limiter sería vector de DoS.
- Verificar que los parámetros de query permitan solo valores esperados (ver getTransactions/getStats: whitelist de type/status, rangos de month/year).
