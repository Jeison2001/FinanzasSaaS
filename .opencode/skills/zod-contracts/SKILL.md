---
name: zod-contracts
description: Zod v4 validation schemas in server/schemas/. Define the API contract for auth, password, transaction, and settings endpoints. Used by validateMiddleware.js to validate req.body on POST/PUT routes.
---

## Files
| Schema | Path | Exports |
|---|---|---|
| `auth` | `server/schemas/auth.schema.js` | `registerSchema`, `loginSchema` |
| `password` | `server/schemas/password.schema.js` | `forgotPasswordSchema`, `resetPasswordSchema` |
| `transaction` | `server/schemas/transaction.schema.js` | `addTransactionSchema`, `updateTransactionSchema` |
| `settings` | `server/schemas/settings.schema.js` | `updateSettingsSchema` |

## Rules
- Schemas are the single source of truth for request body validation.
- `updateTransactionSchema` is a partial of `addTransactionSchema`.
- All schemas use Zod v4 (4.3.6) — NOT Zod v3. API differs.
- Middleware: `server/middlewares/validateMiddleware.js` wraps `schema.parse(req.body)`.
- When adding new endpoints, create schema first, then wire middleware in routes.
