/**
 * API REST de FinanzasSaaS.
 * Autenticación JWT, CRUD de transacciones con soporte de recurrencia,
 * y cron diario de confirmación automática (Migrado a Turso).
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import logger from './logger.js';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import { localToday, getNextDate } from './utils/date.utils.js';

import authRoutes from './routes/auth.routes.js';
import transactionRoutes from './routes/transactions.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// ─────────────────────────────────────────────────
// CRON
// ─────────────────────────────────────────────────

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

cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Iniciando proceso diario...');
    try {
        const lockId = `cron_${localToday()}`;
        try {
            await db.execute({
                sql: 'INSERT INTO cron_locks (id) VALUES (?)',
                args: [lockId]
            });
        } catch (lockErr) {
            logger.info('[CRON] Proceso ya ejecutado por otra instancia hoy. Omitiendo.');
            return;
        }

        logger.info('[CRON] Procesando recurrencias de todos los usuarios...');
        const r = await processAllRecurring();
        logger.info({ changes: r.changes, created: r.recursions }, '[CRON] Completado');
    } catch (err) {
        logger.error({ err }, '[CRON] Error');
    }
});

// ─────────────────────────────────────────────────

const PORT = process.env.PORT;
if (!PORT) {
    logger.fatal('FATAL ERROR: PORT is not defined in .env file.');
    process.exit(1);
}

app.listen(PORT, () => {
    logger.info(`FinanzasSaaS API escuchando en el puerto ${PORT}`);
});
