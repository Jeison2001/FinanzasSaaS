---
name: i18n-keys
description: Internationalization system in src/locales/. 85 translation keys across 3 languages (es, en, ca). useTranslation hook returns t(key) function. All UI strings must go through this system.
---

## Files
| File | Language | Keys |
|---|---|---|
| `src/locales/es.js` | Spanish | 85 |
| `src/locales/en.js` | English | 85 |
| `src/locales/ca.js` | Catalan | 85 |
| `src/locales/index.js` | Hook | `useTranslation(lang) → { t }` |

## Usage
```jsx
const { t } = useTranslation(lang);
<span>{t('dashboard.balance')}</span>
```

## Rules
- Every user-visible string MUST use a translation key — no hardcoded text.
- When adding a new key, add it to ALL 3 locale files simultaneously.
- Key naming convention: `section.element` (e.g., `transactions.addNew`, `auth.loginButton`).
- The `lang` parameter comes from `useAppStore.lang`.
