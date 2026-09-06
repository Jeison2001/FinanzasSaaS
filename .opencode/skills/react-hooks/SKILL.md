---
name: react-hooks
description: Custom React hooks in src/hooks/. 8 hooks handle auth re-export, transactions CRUD with SERVER-SIDE filtering (debounce 300ms + race-guard), KPI stats per period (month/year/all con calendario del cliente), budgets, reports with deltas, settings persistence (timezone sync), notifications, and filter state. useTransactions.js is the primary data hook.
---

## Archivos (src/hooks/)
| Hook | Responsabilidad |
|---|---|
| `useTransactions.js` | Recibe `filters` → GET /transactions con debounce 300ms y **race-guard** (requestIdRef descarta respuestas obsoletas); devuelve {rows-based list, totalAll para EmptyState}; CRUD que notifica errores vía pushToast y devuelve {ok} (los modales no cierran en fallo); confirmOverdueBulk; triggerRefresh único (refresca lista + stats con un solo GET) |
| `useStats.js` | KPIs con mode month/year/all; month/year calculados en el **dispositivo del usuario**; goalPercent sobre lifetimeBalance |
| `useBudgets.js` | GET/PUT presupuestos por mes/año; saveBudgets devuelve {ok} |
| `useReports.js` | reportsData (categorías, período anterior para deltas, trend sin planned) |
| `useFilters.js` | SOLO estado de filtros (type, status, search, month, year, rango) — **el filtrado real es server-side** |
| `useSettings.jsx` | Carga preferencias al login + **sincroniza la timezone del dispositivo** (solo si cambió); saveSettings devuelve {ok} y propaga errores a toasts |
| `useNotifications.js` | Listado + optimistic dismiss con rollback; refresca con refreshKey |
| `useAuth.jsx` | Re-export del useAuthStore |

## Reglas
- Estado global en Zustand; lógica de datos aquí. Sin librerías de data-fetching (axios directo).
- Errores de API SIEMPRE notifican al usuario vía `pushToast` del store — console.error se elimina del bundle de producción.
- Todo useEffect con fetch debe tener guard anti-race si sus inputs cambian rápido.
