---
name: app-root
description: Root React component at src/App.jsx. Orchestrates ALL hooks, stores, and components. Auth gate renders AdminDashboard or client dashboard. Manages modals (add transaction, set goal) and tab state (dashboard/transactions/reports). Every new feature touches this file.
---

## File
`src/App.jsx` (~173 lines)

## Architecture
```
App.jsx
├── isAuthenticated? → AuthCard (login/register/forgot/reset)
├── role === 'admin'? → AdminDashboard
└── Client Dashboard
    ├── Header (lang/currency selector, logout)
    ├── KPICards (4 financial stats)
    ├── Tab: Dashboard → Sidebar (goal + upcoming)
    ├── Tab: Transactions → TransactionTable + Filters
    ├── Tab: Reports → Reports (charts + PDF)
    └── Modals: AddTransactionModal, SetGoalModal
```

## Hook Wiring
- `useAuth()` → auth state
- `useTransactions()` → CRUD + pagination
- `useFilters(transactions)` → filtered data
- `useStats()` → KPI data
- `useSettings()` → load/save preferences
- `useAppStore` → lang, currency, activeTab

## Rules
- No client-side router exists. Navigation = `activeTab` state in useAppStore.
- New features: add tab case here, create component, wire hook.
- This file is the integration point — keep business logic in hooks/controllers.
