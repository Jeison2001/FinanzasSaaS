/**
 * API REST de FinanzasSaaS.
 * Autenticación JWT, CRUD de transacciones con soporte de recurrencia,
 * y cron diario de confirmación automática (Migrado a Turso).
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cron from 'node-cron';
import logger from './logger.js';
import db from './db.js';
import { localToday } from './utils/date.utils.js';

import { processRecurringTransactions } from './services/recurrence.service.js';

import authRoutes from './routes/auth.routes.js';
import transactionRoutes from './routes/transactions.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import budgetRoutes from './routes/budgets.routes.js';


const app = express();
// Detrás de Vercel/Render el rate limiter keying por req.ip necesita confiar
// en el proxy (X-Forwarded-For); sin esto, todos los usuarios comparten la IP
// del proxy y el limiter de login provoca lockout global.
app.set('trust proxy', 1);
app.use(compression());

// Configuración segura de CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : [
        'http://localhost:5173', 
        'http://127.0.0.1:5173', 
        'https://finanzas-saas-three.vercel.app'
      ];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        
        const isAllowed = allowedOrigins.includes(origin) || 
                          origin.endsWith('.vercel.app') || 
                          origin.startsWith('http://localhost:') || 
                          origin.startsWith('http://127.0.0.1:');
                          
        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por política CORS de FinanzasSaaS'));
        }
    },
    credentials: true
}));


app.use(express.json({ limit: '600kb' }));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/budgets', budgetRoutes);


// ─────────────────────────────────────────────────
// CRON
// ─────────────────────────────────────────────────

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

        // Buscar todos los usuarios con transacciones planned vencidas
        const usersRes = await db.execute({
            sql: `SELECT DISTINCT user_id FROM transactions WHERE status = 'planned' AND date <= ? AND recurrence != 'none' AND recurrence IS NOT NULL`,
            args: [localToday()]
        });

        let totalCreated = 0;
        for (const { user_id } of usersRes.rows) {
            const r = await processRecurringTransactions(user_id);
            totalCreated += r.recursions;
        }
        logger.info({ created: totalCreated, users: usersRes.rows.length }, '[CRON] Completado');

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

// Fail-fast: sin JWT_SECRET el server arrancaría y fallaría en el primer login
if (!process.env.JWT_SECRET) {
    logger.fatal('FATAL ERROR: JWT_SECRET is not defined in .env file.');
    process.exit(1);
}

// Limpiar locks huérfanos de procesamiento de recurrencia en el arranque
try {
    await db.execute("DELETE FROM cron_locks WHERE id LIKE 'recurring_%'");
    logger.info('[Startup] Locks huérfanos de recurrencia limpiados con éxito.');
} catch (err) {
    logger.error({ err }, '[Startup] Error limpiando locks huérfanos de recurrencia.');
}

app.listen(PORT, () => {
    logger.info(`FinanzasSaaS API escuchando en el puerto ${PORT}`);
});

