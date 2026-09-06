---
name: zod-contracts
description: Zod v4 validation schemas in server/schemas/. 6 schemas define the API contract for auth, password, transaction (add/update/import), settings (con timezone IANA validada con Intl), budget y notification. Used by validateMiddleware.js on POST/PUT routes.
---

## Archivos (server/schemas/)
| Schema | Contrato |
|---|---|
| `auth.schema.js` | register (email, password min 6, currency contra `SUPPORTED_CURRENCIES`), login |
| `password.schema.js` | forgot (email), reset (token **uuid**, password min 6) |
| `transaction.schema.js` | `addTransactionSchema` (recurrence default none), `updateTransactionSchema` (**SIN defaults** — ver advertencia crítica), `importTransactionsSchema` (csv max 500KB) |
| `settings.schema.js` | savings_goal positivo, language enum es/en/ca, **timezone validada con Intl** (solo IANA reales) |
| `budget.schema.js` | month 0-11, year 2000-2100, items con amount >= 0 (0 = sin presupuesto), max 50 items |
| `notification.schema.js` | marcado de lectura |

## Advertencia crítica (regresión ya ocurrida)
- NUNCA `.partial()` sobre un schema con `.default()`: el default se inyecta en el body de PUT parciales y corrompe datos (mató la recurrencia silenciosamente). `updateTransactionSchema` declara sus campos explícitos sin defaults.
- `status` acepta `overdue` SOLO en update (editar una vencida no debe fallar); en add se rechaza — overdue lo produce el sistema.
- Las fechas validan calendario real (dateLike: rechaza 2026-02-30) vía refine.

## Reglas
- Zod v4 — API distinta de v3, verificar docs ante la duda.
- Al añadir un campo: schema → controller → tests (server/tests/schemas.test.mjs documenta cada contrato con casos borde).
