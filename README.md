# FinanzasSaaS

Gestión financiera personal inteligente: registra ingresos y gastos, planifica transacciones recurrentes, controla presupuestos por categoría y genera informes visuales. Multilingüe (es/en/ca).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind v4 (JSX puro) |
| Estado | Zustand 5 |
| HTTP | Axios (`src/api/axiosClient.js`) |
| Backend | Express 5 + Node.js (ESM) |
| Base de Datos | Turso (libSQL), raw SQL sin ORM |
| Validación | Zod 4 (`server/schemas/`) |
| Auth | JWT + bcrypt |
| Email | Resend (password reset) |
| Jobs | CRON diario + locks distribuidos (`cron_locks`) |

## Puesta en marcha

```bash
# 1. Variables de entorno (backend)
cp .env.example .env   # TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, PORT, VITE_API_URL...

# 2. Backend (API en :PORT)
npm run dev:server

# 3. Frontend (dev server Vite)
npm run dev

# 4. Producción
npm run build && npm run start
```

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/forgot-password` · `/reset-password` | Auth |
| GET/POST | `/api/transactions` | Listar (paginado, filtrado server-side) / crear transacción |
| PUT/DELETE | `/api/transactions/:id` | Editar / eliminar (borrar el ancla cancela la serie) |
| POST | `/api/transactions/confirm-overdue` | Confirmación en bloque de vencidas |
| GET | `/api/transactions/stats?mode=month\|year\|all` | KPIs por período (aritmética en céntimos, exacta) |
| GET | `/api/transactions/reports?month&year&startDate&endDate` | Reportes + comparativa vs período anterior |
| GET/POST | `/api/transactions/export` · `/api/transactions/import` | CSV (export/import) |
| GET/PUT | `/api/budgets?month&year` | Presupuestos mensuales por categoría |
| GET/PUT | `/api/settings` | Preferencias (moneda, idioma, meta de ahorro) |
| GET | `/api/admin/users` · POST `/api/admin/users/:id/reset` | Panel admin (rol `admin`) |

## Modelo de transacciones

- `status`: `completed` (confirmado), `planned` (planificado), `overdue` (vencido sin confirmar).
- Las recurrencias (`daily|weekly|monthly|yearly`) generan la siguiente ocurrencia como `planned`; al vencer pasan a `overdue` — **nada se confirma automáticamente**.
- `series_id` vincula cada ocurrencia con su ancla: quitar la recurrencia purga las planificadas restantes; borrar el ancla cancela la serie.
- **Dinero en céntimos**: `amount_cents` (INTEGER) es la única columna física de dinero; la unidad de moneda se deriva en las queries de lectura (`amount_cents/100.0 AS amount`) — aritmética exacta, sin drift float, sin columnas duplicadas.
- **Timezone por usuario**: el dispositivo la sincroniza en settings; el CRON horario usa la fecha local de cada usuario para marcar vencidos.
- Sin migraciones: los cambios de schema en `server/db.js` se aplican con `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE` idempotente en el arranque.

## Scripts útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Frontend Vite |
| `npm run dev:server` | Backend con nodemon |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `node server/smoke-test.mjs` | Smoke test de la API (15 bloques; requiere server en :3999) |
| `node server/i18n-audit.mjs` | Auditoría i18n: keys usadas/definidas y paridad es/en/ca |
| `node server/cleanup-orphan.mjs` | Elimina usuarios de prueba residuales (smoketest_/debug_/inttest_/dupcheck_) |
| `node migrate.js --force` | Migración one-shot local → Turso (**borra datos remotos**) |
