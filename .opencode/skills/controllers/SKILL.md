---
name: controllers
description: Express REST API controllers in server/controllers/. 7 controllers handle auth (registro con moneda), password reset (con pwd_version), transactions (CRUD + stats por período + reports con deltas + series + CSV + bulk confirm), settings (timezone), admin, budgets y notifications. SQL siempre parametrizado, dinero en amount_cents.
---

## Archivos (server/controllers/)
| Controller | Responsabilidad |
|---|---|
| `auth.controller.js` | register (fuerza role=client, persiste moneda en user_settings, pwd_version:0), login (dummy-hash anti-timing), last_login_at |
| `password.controller.js` | forgot (respuesta genérica), reset (bcrypt + **pwd_version+1** → invalida JWTs previos, token 1h de un solo uso) |
| `transactions.controller.js` | El denso. Listado filtrado server-side ({rows,total}, LIKE escapado, description_norm), stats por período en céntimos (+lifetimeBalance), reports con período anterior (deltas), create/update atómicos (db.transaction) con generación de siguiente ocurrencia SOLO desde planned, delete con semántica de serie (ancla cancela, planned skip regenera), export/import CSV (dedupe por céntimos), confirm-overdue masivo |
| `budgets.controller.js` | GET/PUT presupuestos mensuales por categoría; PUT es DELETE-all + re-INSERT dentro de db.transaction |
| `settings.controller.js` | UPSERT con COALESCE en timezone (un save parcial no la borra) |
| `admin.controller.js` | Listado de usuarios + reset transaccional (transactions, budgets, notifications, tokens, settings a default) |
| `notifications.controller.js` | Listado no-leídas + marcar leída con ownership check |

## Reglas críticas
- Toda query parametrizada con `args` — jamás interpolar valores.
- Dinero SIEMPRE en `amount_cents` (money.utils.js) — `amount` no existe físicamente, se deriva en las lecturas (`amount_cents/100.0 AS amount`).
- Confirmar una `overdue` NO genera ocurrencia (el CRON ya la creó); solo `planned→completed` la genera.
- Los errores de catch loguean con logger y devuelven mensajes genéricos.
