import db from '../db.js';
import logger from '../logger.js';
import { processUserRecurring } from '../controllers/transactions.controller.js';

/**
 * Background worker que procesa tareas encoladas.
 */
export const startJobWorker = () => {
    setInterval(async () => {
        try {
            // Intentar bloquear un job disponible
            const jobRes = await db.execute(`
                UPDATE background_jobs 
                SET status = 'processing', 
                    locked_until = datetime('now', '+5 minutes')
                WHERE id = (
                    SELECT id FROM background_jobs 
                    WHERE status = 'pending' 
                    AND (locked_until IS NULL OR locked_until < datetime('now'))
                    LIMIT 1
                )
                RETURNING *
            `);

            if (jobRes.rows.length > 0) {
                const job = jobRes.rows[0];
                try {
                    if (job.type === 'PROCESS_RECURRING') {
                        const payload = JSON.parse(job.payload);
                        await processUserRecurring(payload.userId);
                    }
                    
                    // Marcar como completado (borrar de la cola)
                    await db.execute('DELETE FROM background_jobs WHERE id = ?', [job.id]);
                } catch (err) {
                    logger.error({ err, jobId: job.id }, 'Error processing job');
                    // Incrementar intentos y volver a poner en pending
                    await db.execute(`
                        UPDATE background_jobs 
                        SET status = 'pending', 
                            attempts = attempts + 1,
                            locked_until = NULL 
                        WHERE id = ?
                    `, [job.id]);
                }
            }
        } catch (err) {
            logger.error(err, 'Job Worker generic error');
        }
    }, 5000);
};


    // Arrancar el primer tick
    tick();
};
