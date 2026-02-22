import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { localToday, getNextDate } from '../utils/date.utils.js';

export const processUserRecurring = async (userId) => {
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

export const getTransactions = async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    // Fire-and-forget: no bloquea la respuesta. El cron diario ya cubre la mayoría de casos.
    processUserRecurring(userId).catch(
        err => logger.warn({ err, userId }, '[AUTO] Error procesando recurrencias')
    );
    try {
        const txResult = await db.execute({
            sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT ? OFFSET ?',
            args: [userId, limit, offset]
        });
        res.json(txResult.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

export const getStats = async (req, res) => {
    const userId = req.user.id;
    try {
        // Ejecutamos agregaciones en la base de datos para no enviar todos los registros por red
        const statsResult = await db.execute({
            sql: `
                SELECT 
                    SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as actualIncome,
                    SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as actualExpense,
                    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as plannedIncome,
                    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as plannedExpense
                FROM transactions 
                WHERE user_id = ?
            `,
            args: [userId]
        });

        const row = statsResult.rows[0] || { actualIncome: 0, actualExpense: 0, plannedIncome: 0, plannedExpense: 0 };
        res.json({
            actualIncome: parseFloat(row.actualIncome) || 0,
            actualExpense: parseFloat(row.actualExpense) || 0,
            plannedIncome: parseFloat(row.plannedIncome) || 0,
            plannedExpense: parseFloat(row.plannedExpense) || 0
        });
    } catch (err) {
        logger.error({ err }, '[GET /transactions/stats] Error al calcular KPIs');
        res.status(500).json({ error: 'Failed to calculate stats' });
    }
};

export const getReports = async (req, res) => {
    const userId = req.user.id;
    const { month, year, startDate, endDate } = req.query;

    try {
        let dateFilter = '';
        let filterArgs = [];

        // months from frontend are 0-indexed (Jan=0), SQL dates use 01–12
        if (startDate && endDate) {
            dateFilter = ' AND date >= ? AND date <= ?';
            filterArgs = [startDate, endDate];
        } else if (month !== undefined && month !== '' && year) {
            const mm = String(Number(month) + 1).padStart(2, '0');
            dateFilter = ' AND date >= ? AND date <= ?';
            filterArgs = [`${year}-${mm}-01`, `${year}-${mm}-31`];
        } else if (year) {
            dateFilter = ' AND date >= ? AND date <= ?';
            filterArgs = [`${year}-01-01`, `${year}-12-31`];
        } else if (month !== undefined && month !== '') {
            const currentYear = new Date().getFullYear();
            const mm = String(Number(month) + 1).padStart(2, '0');
            dateFilter = ' AND date >= ? AND date <= ?';
            filterArgs = [`${currentYear}-${mm}-01`, `${currentYear}-${mm}-31`];
        }

        logger.info({ month, year, startDate, endDate, dateFilter, filterArgs }, '[getReports] filters applied');

        const queryArgs = [userId, ...filterArgs];

        // Gastos por categoría (planned + completed)
        const expensesRes = await db.execute({
            sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense'${dateFilter} GROUP BY category`,
            args: queryArgs
        });
        const expensesByCategory = {};
        expensesRes.rows.forEach(r => expensesByCategory[r.category] = parseFloat(r.total));

        // Ingresos por categoría (planned + completed)
        const incomesRes = await db.execute({
            sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'income'${dateFilter} GROUP BY category`,
            args: queryArgs
        });
        const incomesBySource = {};
        incomesRes.rows.forEach(r => incomesBySource[r.category] = parseFloat(r.total));

        // Tendencia mensual — same filter, LIMIT 6 only when showing all time
        const limitClause = filterArgs.length > 0 ? '' : 'LIMIT 6';
        const orderClause = filterArgs.length > 0 ? 'ASC' : 'DESC';
        const trendRes = await db.execute({
            sql: `
                SELECT 
                    substr(date, 1, 7) as month, 
                    SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as incomes,
                    SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expenses
                FROM transactions 
                WHERE user_id = ?${dateFilter}
                GROUP BY month
                ORDER BY month ${orderClause}
                ${limitClause}
            `,
            args: queryArgs
        });

        const trendData = trendRes.rows
            .map(r => ({
                name: r.month,
                incomes: parseFloat(r.incomes),
                expenses: parseFloat(r.expenses)
            }));

        // If we fetched DESC without filter, reverse for chronological display
        if (!filterArgs.length) trendData.reverse();

        res.json({ expensesByCategory, incomesBySource, trendData });
    } catch (err) {
        logger.error({ err }, '[GET /transactions/reports] Error al calcular reportes');
        res.status(500).json({ error: 'Failed to calculate reports' });
    }
};

export const createTransaction = async (req, res) => {
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
};

export const updateTransaction = async (req, res) => {
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
};

export const deleteTransaction = async (req, res) => {
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
};
