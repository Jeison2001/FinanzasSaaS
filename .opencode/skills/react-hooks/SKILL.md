---
name: react-hooks
description: Custom React hooks in src/hooks/. 6 hooks handle auth re-export, transactions CRUD with pagination, KPI stats fetching, report data, user settings persistence, and client-side filtering. useTransactions.js is the primary data hook.
---

## Files
| Hook | Path | Purpose |
|---|---|---|
| `useAuth` | `src/hooks/useAuth.jsx` | Thin re-export of useAuthStore (1 line) |
| `useTransactions` | `src/hooks/useTransactions.js` | CRUD operations via axiosClient, pagination, refreshTrigger mechanism |
| `useStats` | `src/hooks/useStats.js` | Fetches KPIs from /transactions/stats, computes balance + goal percentage |
| `useReports` | `src/hooks/useReports.js` | Fetches chart data from /transactions/reports with filter params |
| `useSettings` | `src/hooks/useSettings.js` | Loads user prefs on auth, saveSettings() persists to API + syncs stores |
| `useFilters` | `src/hooks/useFilters.js` | Client-side filtering by type/text/month/year/dateRange using useMemo |

## Patterns
- All data hooks use `useEffect` + `useState` for fetch lifecycle.
- `useTransactions` exposes a `refreshTrigger` counter — increment to re-fetch.
- `useSettings` syncs API response to both useAppStore (lang/currency/goal) and local state.
- `useFilters` is purely client-side — no API calls, filters the transactions array in memory.
