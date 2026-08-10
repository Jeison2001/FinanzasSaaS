---
name: zustand-stores
description: Zustand v5 state stores in src/store/. useAuthStore manages JWT token, role, and auth state. useAppStore manages language, currency, savingsGoal, and activeTab. No middleware or persistence beyond localStorage for token.
---

## Files
| Store | Path | State Shape |
|---|---|---|
| `useAuthStore` | `src/store/useAuthStore.js` | `{ token, role, isAuthenticated, login(), logout() }` |
| `useAppStore` | `src/store/useAppStore.js` | `{ lang, currency, savingsGoal, activeTab, setLang(), setCurrency(), setSavingsGoal(), setActiveTab() }` |

## Patterns
- Zustand v5 (5.0.11) — uses `create()` from `zustand`, no `create()(...)` pattern.
- `useAuthStore.login(token)` decodes JWT to extract `role`, stores token in `localStorage`.
- `useAuthStore.logout()` clears localStorage and resets state.
- `useAppStore` has no persistence — state resets on page reload (settings loaded via `useSettings` hook from API).
- Almost every component reads from these stores. Changes here propagate globally.
