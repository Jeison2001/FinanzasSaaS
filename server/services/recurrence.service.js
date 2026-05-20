import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { getNextDate, localToday } from '../utils/date.utils.js';

/**
 * Generates and inserts the next 'planned' transaction for a recurring series.
 * @param {Object} tx - Source transaction with { date, recurrence, user_id, type, category, amount, description }
 * @param {Object} txClient - Database client or transaction client
 */
export const generateNextRecurrence = async (tx, txClient = db) => {
    const nextDateStr = getNextDate(tx.date, tx.recurrence);
    await txClient.execute({
        sql: `INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [uuidv4(), tx.user_id, tx.type, tx.category, tx.amount, tx.description, nextDateStr, 'planned', tx.recurrence]
    });
};

/**
 * Processes overdue 'planned' transactions for a specific user.
 * Uses a distributed lock (cron_locks table) to prevent concurrent processing
 * of the same user from CRON and job worker.
 *
 * @param {string} userId - The user ID to process.
 * @returns {Promise<{ recursions: number, locked?: boolean }>}
 */
export const processRecurringTransactions = async (userId) => {
    const today = localToday();
    const lockKey = `recurring_${userId}`;

    // Adquirir lock distribuido: previene que CRON y worker procesen al mismo usuario simultáneamente
    try {
        await db.execute({
            sql: 'INSERT INTO cron_locks (id) VALUES (?)',
            args: [lockKey]
        });
    } catch {
        logger.info({ userId }, '[Recurrence] Usuario ya siendo procesado por otra instancia — omitiendo');
        return { recursions: 0, locked: true };
    }

    let totalGenerated = 0;
    try {
        let hasMoreProcessable = true;
        let protectionLoopCounter = 0;

        while (hasMoreProcessable && protectionLoopCounter < 500) {
            protectionLoopCounter++;

            const result = await db.execute({
                sql: `SELECT * FROM transactions WHERE user_id = ? AND status = 'planned' AND date <= ? AND recurrence != 'none' AND recurrence IS NOT NULL`,
                args: [userId, today]
            });
            const recurringDue = result.rows;

            if (recurringDue.length === 0) {
                hasMoreProcessable = false;
                break;
            }

            logger.info({ userId, batchSize: recurringDue.length, iteration: protectionLoopCounter }, '[Recurrence] Procesando lote');

            for (const tx of recurringDue) {
                // Ejecutar inserción y actualización dentro de una transacción de base de datos para atomicidad
                const sqlTx = await db.transaction("write");
                try {
                    await generateNextRecurrence(tx, sqlTx);

                    await sqlTx.execute({
                        sql: `UPDATE transactions SET status = 'completed' WHERE id = ?`,
                        args: [tx.id]
                    });
                    
                    await sqlTx.commit();
                    totalGenerated++;
                } catch (txErr) {
                    await sqlTx.rollback();
                    throw txErr; // Abortar ejecución para prevenir inconsistencias
                }
            }
        }

        if (totalGenerated > 0) {
            logger.info({ userId, totalGenerated, iterations: protectionLoopCounter }, '[Recurrence] Procesamiento completado');
            
            // Insertar notificación para el usuario
            await db.execute({
                sql: `INSERT INTO user_notifications (id, user_id, type, message_key, is_read) VALUES (?, ?, ?, ?, 0)`,
                args: [uuidv4(), userId, 'info', 'notif_recurring_processed']
            }).catch(err => logger.error({ err, userId }, '[Recurrence] Error insertando notificación en base de datos'));
        }
        return { recursions: totalGenerated };
    } catch (err) {
        logger.error({ err, userId }, '[Recurrence] Error en processRecurringTransactions');
        return { recursions: totalGenerated };
    } finally {
        // Liberar lock
        await db.execute({
            sql: 'DELETE FROM cron_locks WHERE id = ?',
            args: [lockKey]
        }).catch(() => {});
    }
};

