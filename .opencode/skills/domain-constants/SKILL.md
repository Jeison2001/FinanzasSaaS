---
name: domain-constants
description: Domain constants in src/utils/constants.js. Defines worldCurrencies (10 currencies, chosen once at registration), months (0-11), dynamic years (current-1 to current+1), and categories (income/expense arrays). Used across all UI components for selects and filters.
---

## File
`src/utils/constants.js`

## Exports
| Constant | Type | Content |
|---|---|---|
| `worldCurrencies` | Array<{code, name}> | 10 currencies (EUR default, USD, GBP, JPY, MXN, ARS, COP, CLP, BRL, PEN) |
| `months` | Array<number> | 0-11 (0-indexed, como Date.getMonth()) |
| `years` | Array<number> | dinámico: [año actual − 1, actual, + 1] |
| `categories` | Object | `{ income: [...], expense: [...] }` — claves i18n (cat_*), NO texto |

## Rules
- Categories here must match what the backend accepts in `transaction.schema.js`.
- When adding a new currency, add it here AND update `SUPPORTED_CURRENCIES` in `server/schemas/auth.schema.js` (el registro valida contra esa lista).
- La moneda se elige UNA VEZ en el registro y queda fijada en `user_settings` — NO existe selector global de moneda (se eliminó por engañoso: no hay conversión).
- Years es dinámico — no requiere mantenimiento anual.
- Las categorías se traducen en runtime con `t(cat_key)` — nunca almacenar texto traducido.
