---
name: zustand-stores
description: Zustand v5 state stores in src/store/. useAuthStore manages JWT token, role, and auth state (localStorage). useAppStore manages language, currency, savingsGoal, activeTab, timezone (IANA del dispositivo) y el canal de toasts (pushToast/dismissToast) para errores de API visibles.
---

## Archivos (src/store/)
### useAuthStore.js
- `token`, `role`, `isAuthenticated` — persistidos en localStorage (riesgo XSS conocido y documentado; mitigado con pwd_version en el backend).
- `login(token, role)`, `logout()` (limpia localStorage).

### useAppStore.js
- Preferencias: `lang` (es/en/ca), `currency` (fijada en registro), `savingsGoal`, `activeTab` (transactions/budgets/reports), `timezone` (sincronizada desde el dispositivo en useSettings).
- **Canal de errores**: `toasts: []`, `pushToast(message, type)`, `dismissToast(id)` — los hooks notifican aquí y el componente `Toaster` los renderiza (console.error se elimina del build).

## Reglas
- Leer estado fuera de React con `useAppStore.getState()` (patrón usado por notifyError/saveSettings).
- Selectores finos (`useAppStore(s => s.timezone)`) para evitar re-renders innecesarios.
- No persistir preferencias manualmente — saveSettings (useSettings) las envía al backend; el store es espejo del servidor.
