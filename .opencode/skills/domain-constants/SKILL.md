---
name: domain-constants
description: Domain constants in src/utils/constants.js. Defines worldCurrencies (10 currencies), months (0-11), years (2024-2026), and categories (income/expense arrays). Used across all UI components for selects and filters.
---

## File
`src/utils/constants.js` (~20 lines)

## Exports
| Constant | Type | Content |
|---|---|---|
| `worldCurrencies` | Array<{code, symbol, name}> | 10 currencies (EUR, USD, GBP, etc.) |
| `months` | Array<{value, label}> | 0-11 mapped to month names |
| `years` | Array<number> | [2024, 2025, 2026] |
| `categories` | Object | `{ income: [...], expense: [...] }` |

## Rules
- Categories here must match what the backend accepts in `transaction.schema.js`.
- When adding a new currency, add it here AND update the settings schema.
- Years array needs manual update annually — no dynamic generation.
- Formatters in `src/utils/formatters.js` depend on currency codes from this file.
