import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { generateNextRecurrence } from '../services/recurrence.service.js';
import { addTransactionSchema } from '../schemas/transaction.schema.js';

/**
 * GET /transactions — paginado y filtrado server-side.
 * Filtros: type, status, search (descripción/monto), month (0-indexado),
 * year, startDate, endDate. Responde { rows, total } para paginación
 * correcta sobre el set filtrado (nunca filtrar en cliente sobre páginas).
 */
export const getTransactions = async (req, res) => {
    const userId = req.user.id;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200));
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { type, status, search, month, year, startDate, endDate } = req.query;

    const where = ['user_id = ?'];
    const args = [userId];

    if (type === 'income' || type === 'expense') {
        where.push('type = ?');
        args.push(type);
    }
    if (status === 'completed' || status === 'planned' || status === 'overdue') {
        where.push('status = ?');
        args.push(status);
    }
    if (search && search.trim()) {
        // Escapar comodines de LIKE para que % y _ en la búsqueda sean literales
        const q = `%${search.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        where.push(`(LOWER(description) LIKE LOWER(?) ESCAPE '\\' OR CAST(amount AS TEXT) LIKE ? ESCAPE '\\')`);
        args.push(q, q);
    }
    const qYear = parseInt(year, 10);
    const qMonth = parseInt(month, 10);
    const hasMonth = !isNaN(qMonth) && qMonth >= 0 && qMonth <= 11;
    const hasYear = !isNaN(qYear) && qYear >= 2000 && qYear <= 2100;
    if (hasMonth && hasYear) {
        where.push('substr(date, 1, 7) = ?');
        args.push(`${qYear}-${String(qMonth + 1).padStart(2, '0')}`);
    } else if (hasMonth) {
        where.push('substr(date, 6, 2) = ?');
        args.push(String(qMonth + 1).padStart(2, '0'));
    } else if (hasYear) {
        where.push('substr(date, 1, 4) = ?');
        args.push(String(qYear));
    }
    if (startDate) {
        where.push('date >= ?');
        args.push(startDate);
    }
    if (endDate) {
        where.push('date <= ?');
        args.push(endDate);
    }

    const whereSql = where.join(' AND ');

    try {
        const txResult = await db.execute({
            // Tiebreakers: sin ellos, filas con la misma fecha pueden duplicarse
            // o saltarse entre páginas (series diarias, día de nómina).
            sql: `SELECT * FROM transactions WHERE ${whereSql} ORDER BY date DESC, created_at DESC, id LIMIT ? OFFSET ?`,
            args: [...args, limit, offset]
        });
        const countResult = await db.execute({
            sql: `SELECT COUNT(*) as total FROM transactions WHERE ${whereSql}`,
            args
        });
        res.json({ rows: txResult.rows, total: countResult.rows[0]?.total || 0 });
    } catch (err) {
        logger.error({ err }, '[GET /transactions] Error al listar transacciones');
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

/**
 * KPIs por período. mode = 'month' (default, mes actual) | 'year' | 'all'.
 * Los parámetros month (0-indexado, como el frontend) y year permiten
 * seleccionar un período concreto. lifetimeBalance es el saldo histórico
 * total — se usa para la meta de ahorro, que no depende del período.
 */
export const getStats = async (req, res) => {
    const userId = req.user.id;
    const now = new Date();
    const mode = req.query.mode || 'month';

    const qYear = parseInt(req.query.year, 10);
    const qMonth = parseInt(req.query.month, 10);
    const year = !isNaN(qYear) ? qYear : now.getFullYear();
    const monthIdx = !isNaN(qMonth) && qMonth >= 0 && qMonth <= 11 ? qMonth : now.getMonth();
    const mm = String(monthIdx + 1).padStart(2, '0');

    let dateFilter = '';
    const args = [userId];
    if (mode === 'month') {
        dateFilter = ' AND date >= ? AND date <= ?';
        args.push(`${year}-${mm}-01`, `${year}-${mm}-31`);
    } else if (mode === 'year') {
        dateFilter = ' AND date >= ? AND date <= ?';
        args.push(`${year}-01-01`, `${year}-12-31`);
    }

    try {
        const statsResult = await db.execute({
            sql: `
                SELECT
                    SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as actualIncome,
                    SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as actualExpense,
                    SUM(CASE WHEN type = 'income' AND status = 'planned' THEN amount ELSE 0 END) as plannedIncome,
                    SUM(CASE WHEN type = 'expense' AND status = 'planned' THEN amount ELSE 0 END) as plannedExpense,
                    SUM(CASE WHEN type = 'income' AND status = 'overdue' THEN amount ELSE 0 END) as overdueIncome,
                    SUM(CASE WHEN type = 'expense' AND status = 'overdue' THEN amount ELSE 0 END) as overdueExpense
                FROM transactions
                WHERE user_id = ?${dateFilter}
            `,
            args
        });

        // Saldo histórico total, independiente del período (para la meta de ahorro)
        const lifetimeResult = await db.execute({
            sql: `
                SELECT
                    SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as lifetimeIncome,
                    SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as lifetimeExpense
                FROM transactions
                WHERE user_id = ?
            `,
            args: [userId]
        });

        const row = statsResult.rows[0] || {};
        const lRow = lifetimeResult.rows[0] || {};
        res.json({
            actualIncome: parseFloat(row.actualIncome) || 0,
            actualExpense: parseFloat(row.actualExpense) || 0,
            plannedIncome: parseFloat(row.plannedIncome) || 0,
            plannedExpense: parseFloat(row.plannedExpense) || 0,
            overdueIncome: parseFloat(row.overdueIncome) || 0,
            overdueExpense: parseFloat(row.overdueExpense) || 0,
            lifetimeBalance: (parseFloat(lRow.lifetimeIncome) || 0) - (parseFloat(lRow.lifetimeExpense) || 0)
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
        const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
        const validStart = isDateStr(startDate);
        const validEnd = isDateStr(endDate);

        let dateFilter = '';
        let filterArgs = [];

        // months from frontend are 0-indexed (Jan=0), SQL dates use 01–12
        if (validStart && validEnd) {
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

        // ── Período anterior para comparativa (deltas en la UI) ──
        const dayMs = 86400000;
        const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
        const toStr = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

        let prevStart = null, prevEnd = null;
        if (validStart && validEnd) {
            const start = toDate(startDate);
            const lengthDays = Math.round((toDate(endDate) - start) / dayMs) + 1;
            const prevStartD = new Date(start); prevStartD.setDate(prevStartD.getDate() - lengthDays);
            const prevEndD = new Date(start); prevEndD.setDate(prevEndD.getDate() - 1);
            prevStart = toStr(prevStartD); prevEnd = toStr(prevEndD);
        } else if (month !== undefined && month !== '') {
            const y = year ? parseInt(year, 10) : new Date().getFullYear();
            const mIdx = parseInt(month, 10);
            const prevM = mIdx === 0 ? 11 : mIdx - 1;
            const prevY = mIdx === 0 ? y - 1 : y;
            prevStart = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`;
            prevEnd = `${prevY}-${String(prevM + 1).padStart(2, '0')}-31`;
        } else if (year) {
            prevStart = `${parseInt(year, 10) - 1}-01-01`;
            prevEnd = `${parseInt(year, 10) - 1}-12-31`;
        }

        let prevExpensesByCategory = {};
        let prevIncomesBySource = {};
        if (prevStart && prevEnd) {
            const prevArgs = [userId, prevStart, prevEnd];
            const prevExpensesRes = await db.execute({
                sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND status != 'planned' AND date >= ? AND date <= ? GROUP BY category`,
                args: prevArgs
            });
            prevExpensesRes.rows.forEach(r => prevExpensesByCategory[r.category] = parseFloat(r.total));

            const prevIncomesRes = await db.execute({
                sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'income' AND status != 'planned' AND date >= ? AND date <= ? GROUP BY category`,
                args: prevArgs
            });
            prevIncomesRes.rows.forEach(r => prevIncomesBySource[r.category] = parseFloat(r.total));
        }

        const expensesRes = await db.execute({
            sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND status != 'planned'${dateFilter} GROUP BY category`,
            args: queryArgs
        });
        const expensesByCategory = {};
        expensesRes.rows.forEach(r => expensesByCategory[r.category] = parseFloat(r.total));

        const incomesRes = await db.execute({
            sql: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'income' AND status != 'planned'${dateFilter} GROUP BY category`,
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
                WHERE user_id = ? AND status != 'planned'${dateFilter}
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

        res.json({ expensesByCategory, incomesBySource, trendData, prevExpensesByCategory, prevIncomesBySource });
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
        // Si la transacción inicia una serie recurrente, actúa como ancla:
        // series_id = id propio; todas las ocurrencias generadas lo heredan.
        const seriesId = recurrence && recurrence !== 'none' ? id : null;

        // Atómico: si el proceso muere entre INSERT y la generación de la
        // siguiente ocurrencia, quedaría un ancla recurrente sin planned —
        // y el CRON (que solo procesa planned) nunca regeneraría la serie.
        const sqlTx = await db.transaction("write");
        try {
            await sqlTx.execute({
                sql: 'INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence, series_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                args: [id, userId, type, category, amount, description, date, status, recurrence, seriesId]
            });

            if (recurrence && recurrence !== 'none' && status === 'completed') {
                await generateNextRecurrence({
                    date, recurrence,
                    user_id: userId,
                    type, category, amount, description,
                    series_id: seriesId
                }, sqlTx);
            }
            await sqlTx.commit();
        } catch (txErr) {
            await sqlTx.rollback();
            throw txErr;
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

        // Si la serie existía y ahora se desactiva la recurrencia, purgar las
        // ocurrencias planificadas restantes (cancelar la serie).
        if (oldTx.recurrence && oldTx.recurrence !== 'none' && updatedRecurrence === 'none' && oldTx.series_id) {
            await db.execute({
                sql: `DELETE FROM transactions WHERE series_id = ? AND user_id = ? AND status = 'planned' AND id != ?`,
                args: [oldTx.series_id, userId, id]
            });
        }

        // La transacción pertenece a una serie existente (hereda el ancla) o
        // se convierte en ancla de una nueva serie (series_id = id propio).
        const seriesId = oldTx.series_id || id;

        // Atómico: UPDATE + purga de serie + generación de la siguiente
        // ocurrencia en una sola transacción (mismo patrón que el CRON).
        const sqlTx = await db.transaction("write");
        try {
            await sqlTx.execute({
                sql: `
                    UPDATE transactions
                    SET type = ?, category = ?, amount = ?, description = ?, date = ?, status = ?, recurrence = ?, is_modified = 1, series_id = ?
                    WHERE id = ? AND user_id = ?
                `,
                args: [updatedType, updatedCategory, updatedAmount, updatedDescription, updatedDate, updatedStatus, updatedRecurrence, seriesId, id, userId]
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
                    description: updatedDescription,
                    series_id: seriesId
                }, sqlTx);
            }
            await sqlTx.commit();
        } catch (txErr) {
            await sqlTx.rollback();
            throw txErr;
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
            series_id: seriesId,
            is_modified: 1
        });
    } catch (err) {
        logger.error({ err }, '[PUT /transactions] Error al actualizar transacción');
        res.status(500).json({ error: 'Failed to update transaction' });
    }
};


export const deleteTransaction = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const txResult = await db.execute({
            sql: 'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (txResult.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
        const tx = txResult.rows[0];

        const isAnchor = tx.series_id === tx.id;
        const isPlannedOccurrence = tx.status === 'planned' && tx.recurrence && tx.recurrence !== 'none' && tx.series_id;

        // Borrar el ancla cancela la serie completa: elimina las ocurrencias planificadas restantes.
        if (isAnchor) {
            await db.execute({
                sql: `DELETE FROM transactions WHERE series_id = ? AND user_id = ? AND status = 'planned'`,
                args: [id, userId]
            });
        }

        await db.execute({
            sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });

        // Borrar una ocurrencia planificada de una serie = "saltarla": se
        // regenera la siguiente para no romper la cadena.
        if (isPlannedOccurrence) {
            await generateNextRecurrence(tx);
        }

        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, '[DELETE /transactions] Error al eliminar transacción');
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
};

/**
 * GET /transactions/export
 * Exporta todas las transacciones del usuario a CSV (compatible con el import).
 */
export const exportTransactions = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.execute({
            sql: `SELECT date, type, category, amount, description, status, recurrence FROM transactions WHERE user_id = ? ORDER BY date DESC`,
            args: [userId]
        });

        const escape = (val) => {
            const s = val === null || val === undefined ? '' : String(val);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const header = 'date,type,category,amount,description,status,recurrence';
        const lines = result.rows.map(r =>
            [r.date, r.type, r.category, r.amount, r.description, r.status, r.recurrence].map(escape).join(',')
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="finanzassaa_export_${new Date().toISOString().split('T')[0]}.csv"`);
        // BOM UTF-8: sin él, Excel/Windows interpreta el CSV como Latin-1 y rompe acentos
        res.send('\uFEFF' + [header, ...lines].join('\n'));
    } catch (err) {
        logger.error({ err }, '[GET /transactions/export] Error al exportar CSV');
        res.status(500).json({ error: 'Failed to export transactions' });
    }
};

/**
 * POST /transactions/import
 * Importa transacciones desde CSV (texto plano). Formato por línea:
 * date,type,category,amount,description[,status,recurrence]
 * Valida fila a fila con el contrato Zod; reporta errores sin abortar el resto.
 */
export const importTransactions = async (req, res) => {
    const userId = req.user.id;
    const { csv } = req.body;

    const parseLine = (line) => {
        const cells = [];
        let cur = '', inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { cur += '"'; i++; }
                    else inQuotes = false;
                } else cur += ch;
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                cells.push(cur); cur = '';
            } else cur += ch;
        }
        cells.push(cur);
        return cells.map(c => c.trim());
    };

    try {
        const rawLines = csv.split(/\r?\n/).filter(l => l.trim() !== '');
        if (rawLines.length === 0) return res.status(400).json({ error: 'CSV vacío' });

        // Omitir cabecera si coincide con el formato de export
        const startIdx = rawLines[0].toLowerCase().includes('date') && rawLines[0].toLowerCase().includes('amount') ? 1 : 0;

        let imported = 0;
        const errors = [];
        const rows = rawLines.slice(startIdx, startIdx + 1000);

        for (const line of rows) {
            const [date, type, category, amount, description, status = 'completed', recurrence = 'none'] = parseLine(line);
            const parsed = addTransactionSchema.safeParse({
                date, type, category,
                amount: amount === '' ? undefined : Number(amount),
                description, status, recurrence
            });

            if (!parsed.success) {
                errors.push({ line: line.slice(0, 80), error: parsed.error.issues[0]?.message || 'Datos inválidos' });
                continue;
            }

            const id = uuidv4();
            const seriesId = parsed.data.recurrence !== 'none' ? id : null;
            await db.execute({
                sql: 'INSERT INTO transactions (id, user_id, type, category, amount, description, date, status, recurrence, series_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                args: [id, userId, parsed.data.type, parsed.data.category, parsed.data.amount, parsed.data.description, parsed.data.date, parsed.data.status, parsed.data.recurrence, seriesId]
            });
            imported++;
        }

        res.json({ imported, errors });
    } catch (err) {
        logger.error({ err }, '[POST /transactions/import] Error al importar CSV');
        res.status(500).json({ error: 'Failed to import transactions' });
    }
};
