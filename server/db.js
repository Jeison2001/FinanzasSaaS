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
                last_login_at DATETIME
            )
        `);

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
                amount REAL NOT NULL,
                description TEXT,
                date TEXT NOT NULL,
                status TEXT NOT NULL,
                is_modified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                recurrence TEXT DEFAULT 'none',
                series_id TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Upgrade idempotente para BDs existentes: la columna series_id vincula
        // cada ocurrencia generada con su serie (ancla = id de la transacción origen).
        // Sin sistema de migraciones, ALTER TABLE con try/catch es el mecanismo.
        try {
            await db.execute('ALTER TABLE transactions ADD COLUMN series_id TEXT');
            console.log("Schema upgrade: transactions.series_id añadido.");
        } catch {
            // Columna ya existente o BD recién creada — caso esperado, no es error.
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                savings_goal REAL DEFAULT 10000,
                currency TEXT DEFAULT 'EUR',
                language TEXT DEFAULT 'es',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

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
