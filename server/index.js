/**
 * API REST de FinanzasSaaS.
 * Autenticación JWT, CRUD de transacciones con soporte de recurrencia,
 * y cron diario de confirmación automática.
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

// Fecha de hoy en hora LOCAL del servidor (no UTC). Configura TZ en el entorno para multi-zona.
const localToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Formatea un objeto Date a 'YYYY-MM-DD' usando hora local (evita shift UTC).
const fmtLocalDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Calcula la próxima fecha de recurrencia respetando límites de mes:
 * Jan 31 + mensual → Feb 28 | Feb 29 (bisiesto) + anual → Feb 28.
 */
const getNextDate = (dateStr, recurrence) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    // month aquí es 1-indexed (ej: 2 = febrero)

    if (recurrence === 'daily') {
        return fmtLocalDate(new Date(year, month - 1, day + 1));
    } else if (recurrence === 'weekly') {
        return fmtLocalDate(new Date(year, month - 1, day + 7));
    } else if (recurrence === 'monthly') {
        const srcMonth = month - 1; // 0-indexed
        const targetMonth = (srcMonth + 1) % 12;
        const targetYear = srcMonth === 11 ? year + 1 : year;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        return fmtLocalDate(new Date(targetYear, targetMonth, Math.min(day, lastDay)));
    } else if (recurrence === 'yearly') {
        const targetYear = year + 1;
        const targetMonth = month - 1; // 0-indexed
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        return fmtLocalDate(new Date(targetYear, targetMonth, Math.min(day, lastDay)));
    }

    return dateStr; // fallback sin cambio
};

/**
 * Procesa recurrencias vencidas de UN usuario.
 * Crea la próxima ocurrencia (planned) y marca las vencidas como completed.
 */
const processUserRecurring = (userId) => {
    const today = localToday(); // fecha LOCAL del servidor, no UTC

    const recurringDue = db.prepare(
        `SELECT * FROM transactions
         WHERE user_id = ? AND status = 'planned' AND date <= ?
         AND recurrence != 'none' AND recurrence IS NOT NULL`
    ).all(userId, today);

    if (recurringDue.length === 0) return;

    const insertStmt = db.prepare(
        `INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const tx of recurringDue) {
        const nextDateStr = getNextDate(tx.date, tx.recurrence);
        insertStmt.run(uuidv4(), tx.user_id, tx.type, tx.category, tx.amount, tx.description, nextDateStr, 'planned', tx.recurrence);
    }

    db.prepare(`UPDATE transactions SET status = 'completed' WHERE user_id = ? AND status = 'planned' AND date <= ?`)
        .run(userId, today);
};

/**
 * Procesa recurrencias de TODOS los usuarios. Usado por el cron nocturno.
 */
const processAllRecurring = () => {
    const today = localToday(); // fecha LOCAL del servidor, no UTC

    const recurringDue = db.prepare(
        `SELECT * FROM transactions
         WHERE status = 'planned' AND date <= ?
         AND recurrence != 'none' AND recurrence IS NOT NULL`
    ).all(today);

    if (recurringDue.length === 0) return { changes: 0, recursions: 0 };

    const insertStmt = db.prepare(
        `INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const tx of recurringDue) {
        const nextDateStr = getNextDate(tx.date, tx.recurrence);
        insertStmt.run(uuidv4(), tx.user_id, tx.type, tx.category, tx.amount, tx.description, nextDateStr, 'planned', tx.recurrence);
    }

    const info = db.prepare(
        `UPDATE transactions SET status = 'completed' WHERE status = 'planned' AND date <= ?`
    ).run(today);

    return { changes: info.changes, recursions: recurringDue.length };
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
        const check = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
        if (check) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const userRole = role === 'admin' ? 'admin' : 'client';

        db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(id, normalizedEmail, hashedPassword, userRole);
        db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(id);

        const token = jwt.sign({ id, email, role: userRole }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, role: userRole });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid password' });

        db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// ─────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────

app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admins only.' });

    const users = db.prepare(`
        SELECT u.id, u.email, u.created_at, u.last_login_at, COUNT(t.id) as transaction_count 
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id
        WHERE u.role = 'client'
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `).all();

    res.json(users);
});

// ─────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────

app.get('/api/settings', authenticateToken, (req, res) => {
    const settings = db.prepare('SELECT savings_goal, currency, language FROM user_settings WHERE user_id = ?').get(req.user.id);
    res.json(settings);
});

app.put('/api/settings', authenticateToken, (req, res) => {
    const { savings_goal, currency, language } = req.body;
    db.prepare('UPDATE user_settings SET savings_goal = ?, currency = ?, language = ? WHERE user_id = ?')
        .run(savings_goal, currency, language, req.user.id);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────

// Al cargar transacciones, auto-procesa recurrencias vencidas del usuario
// como red de seguridad por si el cron no corrió (reinicio del servidor, etc.)
app.get('/api/transactions', authenticateToken, (req, res) => {
    const userId = req.user.id;
    try {
        processUserRecurring(userId);
    } catch (e) {
        logger.warn({ userId }, '[AUTO] Error procesando recurrencias');
    }
    const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC').all(userId);
    res.json(transactions);
});

app.post('/api/transactions', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { type, category, amount, description, date, status, recurrence = 'none' } = req.body;

    const id = uuidv4();
    try {
        db.prepare('INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, userId, type, category, amount, description, date, status, recurrence);

        // Recurrente en fecha pasada: crea la próxima ocurrencia en el acto, sin esperar el cron.
        if (recurrence && recurrence !== 'none' && status === 'completed') {
            const nextDate = getNextDate(date, recurrence);
            db.prepare('INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .run(uuidv4(), userId, type, category, amount, description, nextDate, 'planned', recurrence);
        }

        res.status(201).json({ id, type, category, amount, description, date, status, recurrence });
    } catch (err) {
        logger.error({ err }, '[POST /transactions] Error al crear transacción');
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

app.put('/api/transactions/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { type, category, amount, description, date, status, recurrence = 'none' } = req.body;

    const trx = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
    if (!trx) return res.status(404).json({ error: 'Transaction not found' });

    db.prepare(`
        UPDATE transactions 
        SET type = ?, category = ?, amount = ?, description = ?, date = ?, status = ?, recurrence = ?, is_modified = 1
        WHERE id = ? AND user_id = ?
    `).run(type, category, amount, description, date, status, recurrence, id, userId);

    res.json({ id, type, category, amount, description, date, status, recurrence, is_modified: 1 });
});

// Eliminar el último 'planned' de una serie detiene la recurrencia naturalmente.
app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const info = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
    if (info.changes === 0) return res.status(404).json({ error: 'Transaction not found' });

    res.json({ success: true });
});

// ─────────────────────────────────────────────────
// CRON: medianoche diario como respaldo global
// ─────────────────────────────────────────────────

cron.schedule('0 0 * * *', () => {
    logger.info('[CRON] Procesando recurrencias de todos los usuarios...');
    try {
        const r = processAllRecurring();
        logger.info({ changes: r.changes, created: r.recursions }, '[CRON] Completado');
    } catch (err) {
        logger.error({ err }, '[CRON] Error');
    }
});

// ─────────────────────────────────────────────────

app.listen(3001, () => {
    logger.info('FinanzasSaaS API escuchando en http://localhost:3001');
});
