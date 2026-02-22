/**
 * API REST de FinanzasSaaS.
 * Autenticación JWT, CRUD de transacciones con soporte de recurrencia,
 * y cron diario de confirmación automática (Migrado a Turso).
 */
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env file.');
    process.exit(1);
}

// ─────────────────────────────────────────────────
// HELPERS DE FECHA
// ─────────────────────────────────────────────────

const localToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const fmtLocalDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getNextDate = (dateStr, recurrence) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (recurrence === 'daily') {
        return fmtLocalDate(new Date(year, month - 1, day + 1));
    } else if (recurrence === 'weekly') {
        return fmtLocalDate(new Date(year, month - 1, day + 7));
    } else if (recurrence === 'monthly') {
        const srcMonth = month - 1;
        const targetMonth = (srcMonth + 1) % 12;
        const targetYear = srcMonth === 11 ? year + 1 : year;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        return fmtLocalDate(new Date(targetYear, targetMonth, Math.min(day, lastDay)));
    } else if (recurrence === 'yearly') {
        const targetYear = year + 1;
        const targetMonth = month - 1;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        return fmtLocalDate(new Date(targetYear, targetMonth, Math.min(day, lastDay)));
    }
    return dateStr;
};

// ─────────────────────────────────────────────────
// RECURRENCIAS
// ─────────────────────────────────────────────────

const processUserRecurring = async (userId) => {
    const today = localToday();
    try {
        const result = await db.execute({
            sql: `SELECT * FROM transactions WHERE user_id = ? AND status = 'planned' AND date <= ? AND recurrence != 'none' AND recurrence IS NOT NULL`,
            args: [userId, today]
        });

        const recurringDue = result.rows;
        if (recurringDue.length === 0) return;

        for (const tx of recurringDue) {
            const nextDateStr = getNextDate(tx.date, tx.recurrence);
            await db.execute({
                sql: `INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [uuidv4(), tx.user_id, tx.type, tx.category, tx.amount, tx.description, nextDateStr, 'planned', tx.recurrence]
            });
        }

        await db.execute({
            sql: `UPDATE transactions SET status = 'completed' WHERE user_id = ? AND status = 'planned' AND date <= ?`,
            args: [userId, today]
        });
    } catch (err) {
        logger.error({ err }, 'Error in processUserRecurring');
    }
};

const processAllRecurring = async () => {
    const today = localToday();
    try {
        const result = await db.execute({
            sql: `SELECT * FROM transactions WHERE status = 'planned' AND date <= ? AND recurrence != 'none' AND recurrence IS NOT NULL`,
            args: [today]
        });

        const recurringDue = result.rows;
        if (recurringDue.length === 0) return { changes: 0, recursions: 0 };

        for (const tx of recurringDue) {
            const nextDateStr = getNextDate(tx.date, tx.recurrence);
            await db.execute({
                sql: `INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [uuidv4(), tx.user_id, tx.type, tx.category, tx.amount, tx.description, nextDateStr, 'planned', tx.recurrence]
            });
        }

        const updateResult = await db.execute({
            sql: `UPDATE transactions SET status = 'completed' WHERE status = 'planned' AND date <= ?`,
            args: [today]
        });

        return { changes: updateResult.rowsAffected, recursions: recurringDue.length };
    } catch (err) {
        logger.error({ err }, 'Error in processAllRecurring');
        return { changes: 0, recursions: 0 };
    }
};

// ─────────────────────────────────────────────────
// MIDDLEWARE JWT
// ─────────────────────────────────────────────────

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ─────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
    const { email, password, role } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
        const checkResult = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [normalizedEmail]
        });

        if (checkResult.rows.length > 0) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const userRole = role === 'admin' ? 'admin' : 'client';

        await db.execute({
            sql: 'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
            args: [id, normalizedEmail, hashedPassword, userRole]
        });

        await db.execute({
            sql: 'INSERT INTO user_settings (user_id) VALUES (?)',
            args: [id]
        });

        const token = jwt.sign({ id, email: normalizedEmail, role: userRole }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, role: userRole });
    } catch (err) {
        logger.error({ err }, 'Registration failed');
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
        const userResult = await db.execute({
            sql: 'SELECT * FROM users WHERE email = ?',
            args: [normalizedEmail]
        });

        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid password' });

        await db.execute({
            sql: 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
            args: [user.id]
        });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, role: user.role });
    } catch (err) {
        logger.error({ err }, 'Login failed');
        res.status(500).json({ error: 'Login failed' });
    }
});

// ─────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────

app.get('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admins only.' });

    try {
        const usersResult = await db.execute(`
            SELECT u.id, u.email, u.created_at, u.last_login_at, COUNT(t.id) as transaction_count 
            FROM users u
            LEFT JOIN transactions t ON u.id = t.user_id
            WHERE u.role = 'client'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json(usersResult.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ─────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────

app.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const settingsResult = await db.execute({
            sql: 'SELECT savings_goal, currency, language FROM user_settings WHERE user_id = ?',
            args: [req.user.id]
        });
        res.json(settingsResult.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
    const { savings_goal, currency, language } = req.body;
    try {
        await db.execute({
            sql: 'UPDATE user_settings SET savings_goal = ?, currency = ?, language = ? WHERE user_id = ?',
            args: [savings_goal, currency, language, req.user.id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// ─────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────

app.get('/api/transactions', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await processUserRecurring(userId);
    } catch (e) {
        logger.warn({ userId }, '[AUTO] Error procesando recurrencias');
    }
    try {
        const txResult = await db.execute({
            sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC',
            args: [userId]
        });
        res.json(txResult.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { type, category, amount, description, date, status, recurrence = 'none' } = req.body;
    const id = uuidv4();

    try {
        await db.execute({
            sql: 'INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [id, userId, type, category, amount, description, date, status, recurrence]
        });

        if (recurrence && recurrence !== 'none' && status === 'completed') {
            const nextDate = getNextDate(date, recurrence);
            await db.execute({
                sql: 'INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                args: [uuidv4(), userId, type, category, amount, description, nextDate, 'planned', recurrence]
            });
        }

        res.status(201).json({ id, type, category, amount, description, date, status, recurrence });
    } catch (err) {
        logger.error({ err }, '[POST /transactions] Error al crear transacción');
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { type, category, amount, description, date, status, recurrence = 'none' } = req.body;

    try {
        const trxResult = await db.execute({
            sql: 'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (trxResult.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

        await db.execute({
            sql: `
                UPDATE transactions 
                SET type = ?, category = ?, amount = ?, description = ?, date = ?, status = ?, recurrence = ?, is_modified = 1
                WHERE id = ? AND user_id = ?
            `,
            args: [type, category, amount, description, date, status, recurrence, id, userId]
        });

        res.json({ id, type, category, amount, description, date, status, recurrence, is_modified: 1 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const info = await db.execute({
            sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });

        if (info.rowsAffected === 0) return res.status(404).json({ error: 'Transaction not found' });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// ─────────────────────────────────────────────────
// CRON
// ─────────────────────────────────────────────────

cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Procesando recurrencias de todos los usuarios...');
    try {
        const r = await processAllRecurring();
        logger.info({ changes: r.changes, created: r.recursions }, '[CRON] Completado');
    } catch (err) {
        logger.error({ err }, '[CRON] Error');
    }
});

// ─────────────────────────────────────────────────

app.listen(3001, () => {
    logger.info('FinanzasSaaS API escuchando en http://localhost:3001');
});
