---
name: app-root
description: Root React component at src/App.jsx. Orchestrates ALL hooks, stores, and components. Auth gate renders AdminDashboard (con saveSettings) or client dashboard. Manages modals (add transaction, set goal, import/export CSV), Toaster global, período de KPIs (month/year/all) y 3 tabs: transactions, budgets, reports. Every new feature touches this file.
---

## File
`src/App.jsx`

## Estructura
1. **Auth gate**: `!isAuthenticated` → `<AuthCard />` (con selector de moneda en registro).
2. **Admin gate**: role admin sin forceClientView → `<AdminDashboard>` + `<Toaster />`.
3. **Dashboard cliente**:
   - `Header` (idioma, nueva transacción, panel admin si admin, logout)
   - `NotificationBanner` (notificaciones de la BD)
   - `KPICards` con props `period`/`onPeriodChange` (mes/año/todo) y `onConfirmOverdue` (banner ámbar de vencidos con botón "Confirmar todo")
   - Tabs: transactions · budgets (`BudgetsPanel`) · reports (`Reports` + botón import CSV)
   - `TransactionTable` con `onConfirm` (✓ manual) y confirmación de borrado diferenciada para anclas de serie
   - Modales: `AddTransactionModal`, `SetGoalModal`, `ImportExportModal`; `Toaster` global al final

## Reglas
- Cada feature toca este archivo — mantener el wiring plano y legible.
- El estado `period` vive aquí y baja a useStats/KPICards.
- Los modales cierran SOLO si la operación devuelve {ok} — nunca cerrar en fallo.
