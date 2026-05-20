import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { generateNextRecurrence, processRecurringTransactions } from '../services/recurrence.service.js';

export { processRecurringTransactions as processUserRecurring };

export const getTransactions = async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    // Solo encolar un job si no hay otro pendiente/procesando para este usuario
    const jobPayload = JSON.stringify({ userId });
    try {
        const existing = await db.execute({
            sql: `SELECT id FROM background_jobs WHERE type = 'PROCESS_RECURRING' AND payload = ? AND status IN ('pending', 'processing')`,
            args: [jobPayload]
        });
        if (existing.rows.length === 0) {
            db.execute({
                sql: `INSERT INTO background_jobs (id, type, payload) VALUES (?, ?, ?)`,
                args: [uuidv4(), 'PROCESS_RECURRING', jobPayload]
            }).catch(err => logger.error({ err }, '[AUTO] Error encolando job de recurrencia'));
        }
    } catch (err) {
        logger.error({ err }, '[AUTO] Error verificando job existente');
    }

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

        const expensesRes = await db.execute({
            sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense'${dateFilter} GROUP BY category`,
            args: queryArgs
        });
        const expensesByCategory = {};
        expensesRes.rows.forEach(r => expensesByCategory[r.category] = parseFloat(r.total));

        const incomesRes = await db.execute({
            sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'income'${dateFilter} GROUP BY category`,
            args: queryArgs
        });
        const incomesBySource = {};
        incomesRes.rows.forEach(r => incomesBySource[r.category] = parseFloat(r.total));

        const limitClause = filterArgs.length > 0 ? '' : 'LIMIT 12';
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
            await generateNextRecurrence({
                date, recurrence,
                user_id: userId,
                type, category, amount, description
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
    const { type, category, amount, description, date, status, recurrence } = req.body;

    try {
        const trxResult = await db.execute({
            sql: 'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (trxResult.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

        const oldTx = trxResult.rows[0];

        // Fusionar los valores del payload con los existentes para soportar actualizaciones parciales sin sobreescribir con NULL
        const updatedType = type !== undefined ? type : oldTx.type;
        const updatedCategory = category !== undefined ? category : oldTx.category;
        const updatedAmount = amount !== undefined ? amount : oldTx.amount;
        const updatedDescription = description !== undefined ? description : oldTx.description;
        const updatedDate = date !== undefined ? date : oldTx.date;
        const updatedStatus = status !== undefined ? status : oldTx.status;
        const updatedRecurrence = recurrence !== undefined ? recurrence : oldTx.recurrence;

        await db.execute({
            sql: `
                UPDATE transactions
                SET type = ?, category = ?, amount = ?, description = ?, date = ?, status = ?, recurrence = ?, is_modified = 1
                WHERE id = ? AND user_id = ?
            `,
            args: [updatedType, updatedCategory, updatedAmount, updatedDescription, updatedDate, updatedStatus, updatedRecurrence, id, userId]
        });

        const justCompleted = oldTx.status !== 'completed' && updatedStatus === 'completed';
        const justMadeRecurring = oldTx.recurrence === 'none' && updatedRecurrence !== 'none';

        if ((justCompleted || justMadeRecurring) && updatedStatus === 'completed' && updatedRecurrence !== 'none') {
            await generateNextRecurrence({
                date: updatedDate,
                recurrence: updatedRecurrence,
                user_id: userId,
                type: updatedType,
                category: updatedCategory,
                amount: updatedAmount,
                description: updatedDescription
            });
        }

        res.json({ 
            id, 
            type: updatedType, 
            category: updatedCategory, 
            amount: updatedAmount, 
            description: updatedDescription, 
            date: updatedDate, 
            status: updatedStatus, 
            recurrence: updatedRecurrence, 
            is_modified: 1 
        });
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
