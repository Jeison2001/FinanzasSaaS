---
name: axios-client
description: Axios HTTP client singleton in src/api/axiosClient.js. Configures base URL from VITE_API_URL, JWT Bearer token injection from localStorage via request interceptor, and automatic logout + redirect on 401 responses from protected routes (public auth routes exempted).
---

## File
`src/api/axiosClient.js`

## Configuration
- `baseURL`: `import.meta.env.VITE_API_URL` (termina forzosamente en `/api`) — falla fast si no está definida.
- Request interceptor: adjunta `Authorization: Bearer <token>` leído de **localStorage** directamente (`localStorage.getItem('token')`).
- Response interceptor: 401 en rutas NO públicas → limpia token/role de localStorage y redirige a `/`. Las rutas públicas exentas están listadas explícitamente en `PUBLIC_AUTH_ROUTES` (login, register, forgot-password, reset-password).

## Usage
```js
import axiosClient from '../api/axiosClient';
const { data } = await axiosClient.get('/transactions?type=income');
await axiosClient.put(`/budgets`, { month, year, items });
```

## Rules
- Nunca crear una segunda instancia de Axios — siempre este singleton.
- La inyección de token es automática — no setear headers manualmente.
- El build de producción elimina console.* (vite.config drop) — los errores de axios deben notificarse vía pushToast, no console.
