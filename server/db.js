/**
 * Inicializa la base de datos SQLite y aplica el schema.
 * Usa WAL mode para mejor rendimiento en escrituras concurrentes.
 * Las columnas añadidas con ALTER TABLE son seguras al reiniciar (catch de duplicados).
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure the data directory exists
const dataDir = join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const db = new Database(join(dataDir, 'finanzas.db'));
db.pragma('journal_mode = WAL');

// Initialize schema for SaaS Isolation
const initDB = () => {
    // Users Table (Tenants)
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'client',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME
        )
    `);

    // Transactions Table
    db.exec(`
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
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // User Settings Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT PRIMARY KEY,
            savings_goal REAL DEFAULT 10000,
            currency TEXT DEFAULT 'EUR',
            language TEXT DEFAULT 'es',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // safe add recurrence column
    try {
        db.exec("ALTER TABLE transactions ADD COLUMN recurrence TEXT DEFAULT 'none'");
    } catch (e) {
        // column might already exist
    }
};

initDB();

export default db;
