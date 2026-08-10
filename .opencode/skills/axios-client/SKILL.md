---
name: axios-client
description: Axios HTTP client singleton in src/api/axiosClient.js. Configures base URL from VITE_API_URL, JWT Bearer token injection via request interceptor, and automatic logout + redirect on 401 responses from protected routes.
---

## File
`src/api/axiosClient.js` (51 lines)

## Configuration
- `baseURL`: `import.meta.env.VITE_API_URL`
- Request interceptor: attaches `Authorization: Bearer <token>` from `useAuthStore.getState().token`
- Response interceptor: on 401 from non-auth routes → calls `useAuthStore.getState().logout()` → redirects to `/`

## Usage
```js
import api from '../api/axiosClient';
const { data } = await api.get('/transactions');
await api.post('/transactions', payload);
```

## Rules
- Never create a second Axios instance — always import this singleton.
- Token injection is automatic — no need to manually set headers.
- The 401 interceptor skips `/api/auth/*` routes to avoid logout loops during login/register.
