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
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

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
            CREATE TABLE IF NOT EXISTS cron_locks (
                id TEXT PRIMARY KEY,
                locked_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Database schema initialized gracefully.");
    } catch (error) {
        console.error("Error initializing DB schema:", error);
    }
};

initDB();

export default db;
