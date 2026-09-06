---
name: i18n-keys
description: Internationalization system in src/locales/. 133 translation keys across 3 languages (es, en, ca) with perfect parity. useTranslation hook returns t(key). Includes dynamic key families (cat_*, notif_*, period*) resolved at runtime. Audit script available: node server/i18n-audit.mjs.
---

## Files (src/locales/)
- `es.js`, `en.js`, `ca.js` — 133 keys cada uno, **paridad perfecta verificada**.
- `index.js` — `useTranslation(lang)` devuelve `t(key)`; key desconocida devuelve la propia key (el fallback `t('x') || 'default'` NO funciona — la key es truthy).

## Familias de keys dinámicas
| Prefijo | Resolución | Dónde |
|---|---|---|
| `cat_*` | `t(item.category)` / `t(ck)` desde `constants.js` | Tabla, modal, filtros, reports, presupuestos |
| `notif_*` | `t(notif.message_key)` desde la BD | NotificationBanner (ej. notif_recurring_processed, notif_recurring_truncated) |
| `period*` | `t(opt.key)` desde periodOptions | KPICards (periodMonth/periodYear/periodAll) |

## Reglas
- Toda cadena visible usa `t('key')` — incluidos login/registro/forgot/reset (AuthCard completo está internacionalizado).
- Al añadir una key: añadirla en LOS TRES idiomas y correr `node server/i18n-audit.mjs` (audita ambas direcciones: usadas sin definir y definidas sin usar, con soporte de keys dinámicas).
- Interpolación simple con `.replace('{n}', valor)` (ver overdueWarning, bulkConfirmed, importPartial).
