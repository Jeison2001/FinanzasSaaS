import { createClient } from "@libsql/client";
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || !dbAuthToken) {
    console.error('FATAL ERROR: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not defined in .env');
    process.exit(1);
}

const db = createClient({
    url: dbUrl,
    authToken: dbAuthToken,
});

const initDB = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'client',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login_at DATETIME,
                pwd_version INTEGER DEFAULT 0
            )
        `);

        // pwd_version: permite invalidar tokens JWT emitidos antes de un reset
        // de contraseña sin cambiar la expiración global (365d por decisión de producto).
        try {
            await db.execute('ALTER TABLE users ADD COLUMN pwd_version INTEGER DEFAULT 0');
            console.log("Schema upgrade: users.pwd_version añadido.");
        } catch {
            // Columna ya existente o BD recién creada — caso esperado, no es error.
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                message_key TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                category TEXT NOT NULL,
                amount_cents INTEGER NOT NULL DEFAULT 0,
                description TEXT,
                date TEXT NOT NULL,
                status TEXT NOT NULL,
                is_modified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                recurrence TEXT DEFAULT 'none',
                series_id TEXT,
                description_norm TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // ── Migración: dinero en céntimos como ÚNICA fuente de verdad ──
        // amount era REAL (float, drift en sumas). Secuencia idempotente y
        // tolerante a procesos paralelos: 1) añadir amount_cents  2) rellenar
        // desde amount  3) DROP amount. La unidad de moneda se deriva en las
        // queries de lectura (amount_cents/100.0 AS amount) — no hay columna
        // física duplicada ni columnas generadas que mantener.
        try {
            await db.execute('ALTER TABLE transactions ADD COLUMN amount_cents INTEGER');
            console.log("Schema upgrade: transactions.amount_cents añadido.");
        } catch {
            // Columna ya existente o BD recién creada — caso esperado, no es error.
        }
        // Backfill independiente del ALTER: si falla, se reintenta en el
        // próximo arranque. Si otro proceso ya dropeó amount, este UPDATE
        // falla y se ignora — solo hay NULLs pendientes la primera vez.
        try {
            await db.execute(`
                UPDATE transactions
                SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER)
                WHERE amount_cents IS NULL
            `);
        } catch {
            // amount ya fue eliminada por otro arranque — backfill ya hecho.
        }
        try {
            await db.execute('ALTER TABLE transactions DROP COLUMN amount');
            console.log("Schema upgrade: amount eliminada — amount_cents es la única fuente.");
        } catch {
            // Ya eliminada o BD recién creada — caso esperado, no es error.
        }

        // Upgrade idempotente para BDs existentes: la columna series_id vincula
        // cada ocurrencia generada con su serie (ancla = id de la transacción origen).
        // Sin sistema de migraciones, ALTER TABLE con try/catch es el mecanismo.
        try {
            await db.execute('ALTER TABLE transactions ADD COLUMN series_id TEXT');
            console.log("Schema upgrade: transactions.series_id añadido.");
        } catch {
            // Columna ya existente o BD recién creada — caso esperado, no es error.
        }

        // description_norm: descripción en minúsculas y sin acentos, para que
        // la búsqueda funcione con es/ca (LIKE de SQLite solo es case-insensitive
        // en ASCII). Backfill idempotente: solo toca filas aún no normalizadas.
        // 21 REPLACEs anidados (A-Z lo resuelve LOWER); contarlos si se editan.
        try {
            await db.execute('ALTER TABLE transactions ADD COLUMN description_norm TEXT');
            await db.execute(`
                UPDATE transactions SET description_norm = LOWER(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        description,
                        'Á','a'),
                        'É','e'),
                        'Í','i'),
                        'Ó','o'),
                        'Ú','u'),
                        'Ü','u'),
                        'Ñ','n'),
                        'Ç','c'),
                        'À','a'),
                        'È','e'),
                        'Ì','i'),
                        'Ò','o'),
                        'Ù','u'),
                        'á','a'),
                        'é','e'),
                        'í','i'),
                        'ó','o'),
                        'ú','u'),
                        'ü','u'),
                        'ñ','n'),
                        'ç','c')
                ) WHERE description_norm IS NULL
            `);
            console.log("Schema upgrade: transactions.description_norm añadido y rellenado.");
        } catch {
            // Columna ya existente o BD recién creada — caso esperado, no es error.
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                savings_goal REAL DEFAULT 10000,
                currency TEXT DEFAULT 'EUR',
                language TEXT DEFAULT 'es',
                timezone TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Timezone del usuario (IANA, p.ej. 'America/Bogota'): el CRON calcula
        // su fecha local para marcar vencidos en el día correcto.
        try {
            await db.execute('ALTER TABLE user_settings ADD COLUMN timezone TEXT');
            console.log("Schema upgrade: user_settings.timezone añadido.");
        } catch {
            // Columna ya existente o BD recién creada — caso esperado, no es error.
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS cron_locks (
                id TEXT PRIMARY KEY,
                locked_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Presupuestos mensuales por categoría (una fila por categoría/mes/año)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS budgets (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, category, month, year),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Índices secundarios para optimización de rendimiento
        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC)
        `);

        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_transactions_user_recurring 
            ON transactions (user_id, status, date) 
            WHERE recurrence != 'none' AND recurrence IS NOT NULL
        `);

        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_transactions_series 
            ON transactions (series_id) 
            WHERE series_id IS NOT NULL
        `);

        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_budgets_user_period 
            ON budgets (user_id, month, year)
        `);

        console.log("Database schema initialized gracefully.");
    } catch (error) {
        console.error("Error initializing DB schema:", error);
    }
};

initDB();

export default db;
