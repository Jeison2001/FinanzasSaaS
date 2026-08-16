# FinanzasSaaS — Gobernanza de Agentes

## Protocolo de Inicio Obligatorio

**CRÍTICO**: Al iniciar cualquier sesión nueva, ejecuta estas acciones ANTES de cualquier otra operación:

1. `read AGENTS.md` — cargar este documento de gobernanza
2. `read opencode.json` — cargar configuración, agentes, y skills disponibles
3. Verificar qué Skills son relevantes para la tarea actual e invocarlas

No realices búsquedas, ediciones, ni ejecuciones hasta completar este protocolo.

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React 19 + Vite 7 + Tailwind v4 | JSX puro, sin TypeScript |
| Estado | Zustand 5 | Stores en `src/store/` |
| HTTP | Axios | Singleton en `src/api/axiosClient.js` |
| Backend | Express 5 + Node.js (ESM) | `server/index.js` |
| Base de Datos | Turso (libSQL) | Raw SQL, sin ORM, sin migraciones |
| Validación | Zod 4 | Schemas en `server/schemas/` |
| Auth | JWT + bcrypt | 365 días de expiración |
| Email | Resend | Password reset flow |
| Jobs | CRON diario + locks distribuidos | `server/index.js` + `recurrence.service.js` |
| i18n | Custom hook | 3 idiomas: es/en/ca |

---

## Estructura del Proyecto

```
FinanzasSaaS/
├── src/                          # Frontend React SPA
│   ├── App.jsx                   # ROOT — orquesta TODO. Cada feature toca este archivo.
│   ├── main.jsx                  # Entry point (React 19 StrictMode)
│   ├── api/axiosClient.js        # HTTP singleton + JWT interceptor + 401 handler
│   ├── store/                    # Zustand stores (auth + app state)
│   ├── hooks/                    # Custom hooks (datos + lógica de negocio)
│   ├── utils/                    # Constantes de dominio + formatters
│   ├── locales/                  # i18n (85 keys × 3 idiomas)
│   └── components/               # UI organizada por feature
├── server/                       # Backend Express REST API
│   ├── index.js                  # Entry: CORS, routes, CRON
│   ├── db.js                     # SCHEMA CANÓNICO — 7 tablas, raw SQL
│   ├── controllers/              # Lógica de negocio (6 controllers)
│   ├── routes/                   # Definiciones de rutas (5 archivos)
│   ├── middlewares/              # Auth JWT, rate limit, Zod validate
│   ├── schemas/                  # Contratos Zod (5 schemas)
│   ├── services/                 # Email, Recurrence
│   └── utils/                    # Date arithmetic para recurrencia
├── opencode.json                 # Configuración de agentes y herramientas
└── AGENTS.md                     # Este archivo — gobernanza
```

---

## Puntos de Carga Cognitiva (Alta Densidad)

Estos archivos concentran la mayor complejidad y son los más buscados:

### Tier 1 — Crítico (cada cambio los toca)
- `server/controllers/transactions.controller.js` — CRUD + stats + reports + CSV + series
- `server/services/recurrence.service.js` — Lógica UNIFICADA de recurrencia. Única fuente.
- `server/db.js` — Schema canónico. Fuente canónica.

// ...

## Advertencias Arquitecturales

1. **Sin ORM / Sin migraciones**: Schema raw SQL en `db.js`. Cambios de schema: `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` idempotente en `initDB()` (no destructivos).
3. **Sin router frontend**: Navegación controlada por `activeTab` en `useAppStore`. No usar react-router.
4. **Tests**: suites en `server/tests/` — `npm test` (unitarios + integración; la integración levanta su propio server en :3998). Smoke adicional: `node server/smoke-test.mjs` (requiere server en :3999).
5. **App.css es dead code**: No editar. Tailwind v4 se importa en `index.css`.
6. **JWT expira en 365 días**: Riesgo de seguridad conocido. No cambiar sin análisis de impacto.
7. **Modelo de transacciones**: `planned` → `overdue` → `completed`. Nada se auto-confirma. Series recurrentes vía `series_id` (ancla = transacción origen): quitar recurrencia purga planificadas; borrar ancla cancela la serie.
8. **Zod defaults en PUT**: Nunca usar `.partial()` sobre schemas con `.default()` — el default se inyecta en actualizaciones parciales y corrompe datos (ver `updateTransactionSchema`).

---

## Reglas Obligatorias

### 1. Skills-First
Antes de buscar manualmente en el codebase, verifica si existe una Skill que cubra el área. Skills disponibles:

| Skill | Área |
|---|---|
| `db-schema` | Tablas, columnas, relaciones, server/db.js |
| `controllers` | 5 controllers, endpoints, lógica de negocio |
| `zod-contracts` | 6 schemas Zod, validación de API |
| `zustand-stores` | 2 stores, estado global frontend |
| `react-hooks` | 6 hooks, data fetching, filtering |
| `axios-client` | HTTP singleton, interceptors, auth |
| `api-routes` | 13 endpoints, middleware stack |
| `i18n-keys` | 85 keys × 3 idiomas, hook useTranslation |
| `domain-constants` | Monedas, categorías, meses, años |
| `server-entry` | Express setup, CRON, job worker boot |
| `app-root` | React root, wiring de hooks/components |
| `job-worker` | Background jobs, polling, retry logic |

### 2. Protocolo de Búsqueda Escalada
Navega el codebase en orden de menor a mayor ruido. Cada paso se intenta solo si el anterior no resuelve la búsqueda:

| Paso | Herramienta | Cuándo usarla |
|---|---|---|
| 1 | `skill` | Cargar la Skill del área (ver tabla en §1). Cubre el 80% de las consultas frecuentes. |
| 2 | `lsp_goToDefinition` | Navegación semántica a definiciones de funciones/variables. Requiere `OPENCODE_EXPERIMENTAL_LSP_TOOL=true`. Se activa lazily al leer archivos. |
| 3 | `glob` | Localizar archivos por patrón (`**/*.controller.js`, `src/**/*.jsx`). Confirma rutas antes de leer. |
| 4 | `read` | Leer archivos específicos ya identificados en pasos 1-3. |
| 5 | `grep` | **Último recurso**. Solo sobre directorios acotados (`server/controllers/`, `src/hooks/`). Prohibido escanear la raíz del proyecto (`grep` sobre `/` o `./`). |

> **LSP activo**: Las variables `OPENCODE_EXPERIMENTAL_LSP_TOOL` y `OPENCODE_EXPERIMENTAL_LSP_TY` están habilitadas via entorno. El LSP se activa lazily al leer archivos. Consultar `opencode-env-setup.txt` para configuración por plataforma.

> **Prohibición explícita**: No ejecutar `grep` con `path` apuntando a la raíz del repositorio. Siempre acotar a subdirectorios específicos.

### 3. Sesiones Atómicas
Una sola tarea por sesión. No mezclar refactoring con features nuevas. No mezclar frontend con backend salvo que la tarea lo requiera explícitamente.

### 4. Protocolo de Salida Limpia
- Densidad técnica máxima. Sin cortesías.
- Prohibido repetir código no modificado.
- Usar bloques diff para ediciones.
- Priorizar completitud funcional sobre explicación.

### 5. Convenciones de Código
- **JavaScript puro** — no introducir TypeScript.
- **ESM** — `import/export`, no `require/module.exports`.
- **Tailwind v4** — clases utility, no CSS custom salvo excepciones justificadas.
- **Zod v4** — NO Zod v3. API diferente (verificar docs si hay duda).
- **Express 5** — API ligeramente diferente a Express 4.
- **i18n obligatorio** — toda cadena visible al usuario debe usar `t('key')`.
- **Parametrizar queries SQL** — nunca interpolación directa de valores.

### 6. Flujo para Nuevos Endpoints
1. Crear schema Zod en `server/schemas/`
2. Crear controller en `server/controllers/`
3. Crear route file en `server/routes/`
4. Montar en `server/index.js`
5. Agregar tipos/constantes necesarias en `src/utils/constants.js`
6. Crear hook en `src/hooks/` si el frontend consume el endpoint
7. Actualizar i18n si hay nuevas cadenas visibles

### 7. Flujo para Nuevos Componentes UI
1. Crear componente en `src/components/<feature>/`
2. Crear o reutilizar hook para datos
3. Agregar keys i18n en los 3 idiomas
4. Integrar en `src/App.jsx` (tab, modal, o condicional)
5. Usar Tailwind v4 para estilos

---

## Comandos Rápidos

| Comando | Descripción |
|---|---|
| `/dev` | Arranca entorno de desarrollo |
| `/check-schema` | Verifica coherencia Zod ↔ DB |
| `/sync-i18n` | Audita claves i18n faltantes |
| `/audit-security` | Auditoría de seguridad completa |

---

## Agentes Especializados

| Agente | Modo | Usar cuando... |
|---|---|---|
| `build` | Primary | Implementar features, corregir bugs, refactorizar |
| `plan` | Primary | Analizar código, planificar cambios, revisar sin modificar |
| `@db-architect` | Subagent | Cambios en schema DB, queries complejas, diseño de tablas |
| `@api-engineer` | Subagent | Nuevos endpoints, cambios en API, middlewares |
| `@ui-engineer` | Subagent | Componentes React, hooks, stores, Tailwind |
| `@security-auditor` | Subagent | Auditoría de seguridad (read-only) |
