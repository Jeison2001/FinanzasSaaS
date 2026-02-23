import db from '../db.js';
import logger from '../logger.js';
import { processUserRecurring } from '../controllers/transactions.controller.js';

// Configuration
const POLL_INTERVAL_MS = 5000; // Check DB every 5 seconds
const BATCH_SIZE = 5;          // Process up to 5 jobs per tick
const LOCK_TIMEOUT_MINS = 5;    // Jobs locked longer than this are considered crashed and retried

export const startJobWorker = () => {
    logger.info('[WORKER] Iniciando sistema de Jobs en segundo plano...');

    // El bucle asíncrono infinito
    const tick = async () => {
        try {
            // 1. Desbloquear trabajos huérfanos (crashed workers)
            const nowIso = new Date().toISOString();
            await db.execute({
                sql: `UPDATE background_jobs 
                      SET status = 'pending', locked_until = NULL 
                      WHERE status = 'processing' 
                      AND locked_until < ?`,
                args: [nowIso]
            });

            // 2. Buscar trabajos pendientes
            const pendingJobs = await db.execute({
                sql: `SELECT * FROM background_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
                args: [BATCH_SIZE]
            });

            if (pendingJobs.rows.length === 0) {
                // No hay trabajo, dormir hasta el próximo tick
                setTimeout(tick, POLL_INTERVAL_MS);
                return;
            }

            // 3. Bloquear los trabajos (Locking) para que otro servidor no los toque
            const lockDate = new Date();
            lockDate.setMinutes(lockDate.getMinutes() + LOCK_TIMEOUT_MINS);
            const lockIso = lockDate.toISOString();

            const jobIds = pendingJobs.rows.map(j => j.id);
            const placeholders = jobIds.map(() => '?').join(',');
            await db.execute({
                sql: `UPDATE background_jobs 
                      SET status = 'processing', 
                          locked_until = ?,
                          attempts = attempts + 1
                      WHERE id IN (${placeholders})`,
                args: [lockIso, ...jobIds]
            });

            // 4. Procesar cada trabajo de forma concurrente
            await Promise.allSettled(pendingJobs.rows.map(async (job) => {
                try {
                    if (job.type === 'PROCESS_RECURRING') {
                        const payload = JSON.parse(job.payload);
                        // Ejecutamos la lógica potente que construimos antes
                        await processUserRecurring(payload.userId);
                    }

                    // Si todo va bien, borramos el ticket (ahorra writes en la capa gratis)
                    await db.execute({
                        sql: `DELETE FROM background_jobs WHERE id = ?`,
                        args: [job.id]
                    });
                } catch (err) {
                    logger.error({ err, jobId: job.id }, '[WORKER] Error procesando job específico');
                    // Si falla, lo devolvemos a pending o fallido según intentos
                    if (job.attempts >= 3) {
                        await db.execute({ sql: `UPDATE background_jobs SET status = 'failed' WHERE id = ?`, args: [job.id] });
                    } else {
                        await db.execute({ sql: `UPDATE background_jobs SET status = 'pending', locked_until = NULL WHERE id = ?`, args: [job.id] });
                    }
                }
            }));

        } catch (error) {
            logger.error({ error }, '[WORKER] Error crítico en el loop principal');
        }

        // Bucle infinito: volver a llamar al siguiente tick inmediatamente si había trabajo, o esperar si no había
        setTimeout(tick, POLL_INTERVAL_MS);
    };

    // Arrancar el primer tick
    tick();
};
