import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';

/**
 * GET /budgets?month&year
 * Devuelve los presupuestos del usuario para el período indicado.
 * Sin parámetros, usa el mes/año actuales.
 */
export const getBudgets = async (req, res) => {
    const userId = req.user.id;
    const now = new Date();
    const qYear = parseInt(req.query.year, 10);
    const qMonth = parseInt(req.query.month, 10);
    const year = !isNaN(qYear) ? qYear : now.getFullYear();
    const month = !isNaN(qMonth) && qMonth >= 0 && qMonth <= 11 ? qMonth : now.getMonth();

    try {
        const result = await db.execute({
            sql: 'SELECT category, amount FROM budgets WHERE user_id = ? AND month = ? AND year = ? ORDER BY category',
            args: [userId, month, year]
        });
        res.json(result.rows.map(r => ({ category: r.category, amount: parseFloat(r.amount) })));
    } catch (err) {
        logger.error({ err, userId }, '[GET /budgets] Error al listar presupuestos');
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
};

/**
 * PUT /budgets
 * Reemplaza el conjunto de presupuestos del mes/año: los items con
 * amount > 0 se insertan (UPSERT), el resto se eliminan. Atómico.
 */
export const saveBudgets = async (req, res) => {
    const userId = req.user.id;
    const { month, year, items } = req.body;

    const sqlTx = await db.transaction("write");
    try {
        await sqlTx.execute({
            sql: 'DELETE FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
            args: [userId, month, year]
        });

        for (const item of items) {
            if (item.amount > 0) {
                await sqlTx.execute({
                    sql: 'INSERT INTO budgets (id, user_id, category, amount, month, year) VALUES (?, ?, ?, ?, ?, ?)',
                    args: [uuidv4(), userId, item.category, item.amount, month, year]
                });
            }
        }

        await sqlTx.commit();
        res.json({ success: true });
    } catch (err) {
        await sqlTx.rollback();
        logger.error({ err, userId }, '[PUT /budgets] Error al guardar presupuestos');
        res.status(500).json({ error: 'Failed to save budgets' });
    }
};
