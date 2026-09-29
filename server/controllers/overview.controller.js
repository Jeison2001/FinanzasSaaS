import db from '../db.js';
import logger from '../logger.js';
import { fromCents } from '../utils/money.utils.js';
import { getAccountFlows, getCardUsage, getLoanPaid } from '../services/entities.service.js';

/**
 * GET /overview — radiografía financiera del usuario en una sola respuesta.
 * TODO se deriva por agregación SQL con GROUP BY (sin loops N+1): saldos de
 * cuentas, usado de tarjetas y pagado de préstamos salen de transactions.
 * Montos en unidades de moneda (desde céntimos, conversión al final para
 * evitar drift float en las sumas).
 *
 * netWorth = cuentas − usado de tarjetas − saldo pendiente de préstamos.
 * orphans = resumen de income/expense históricos sin cuenta (ruta legacy
 * pre-entidades): count + neto, en la MISMA query agregada (sin N+1). Los
 * tipos con semántica propia (transfer/card_purchase/card_payment/
 * loan_payment) quedan fuera por construcción: exigen su entidad y no
 * aterrizan en cuentas como income/expense.
 */
export const getOverview = async (req, res) => {
    const userId = req.user.id;

    try {
        const [accountsRes, cardsRes, loansRes, flows, usage, paid, orphansRes] = await Promise.all([
            db.execute({ sql: 'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at, id', args: [userId] }),
            db.execute({ sql: 'SELECT * FROM credit_cards WHERE user_id = ? ORDER BY created_at, id', args: [userId] }),
            db.execute({ sql: 'SELECT * FROM loans WHERE user_id = ? ORDER BY created_at, id', args: [userId] }),
            getAccountFlows(userId),
            getCardUsage(userId),
            getLoanPaid(userId),
            db.execute({
                sql: `
                    SELECT COUNT(*) AS n,
                           SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END) AS income_c,
                           SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) AS expense_c
                    FROM transactions
                    WHERE user_id = ? AND type IN ('income', 'expense') AND account_id IS NULL
                `,
                args: [userId]
            })
        ]);

        // Sumas agregadas en céntimos (enteros exactos); conversión a unidades
        // solo al final.
        let accountsTotalC = 0;
        const accounts = accountsRes.rows.map(r => {
            const balanceC = (Number(r.initial_cents) || 0) + (flows.get(r.id) || 0);
            accountsTotalC += balanceC;
            return { id: r.id, name: r.name, balance: fromCents(balanceC) };
        });

        let cardsUsedC = 0;
        const cards = cardsRes.rows.map(r => {
            const usedC = usage.get(r.id) || 0;
            cardsUsedC += usedC;
            const limitCents = Number(r.limit_cents) || 0;
            return {
                id: r.id,
                name: r.name,
                used: fromCents(usedC),
                limit: fromCents(limitCents),
                minPayment: fromCents(Math.round(Math.max(usedC, 0) * (Number(r.min_payment_pct) || 0) / 100))
            };
        });

        let loansRemainingC = 0;
        const loans = loansRes.rows.map(r => {
            const principalCents = Number(r.principal_cents) || 0;
            const paymentCents = Number(r.monthly_payment_cents) || 0;
            const paidC = paid.get(r.id) || 0;
            const remainingC = principalCents - paidC;
            loansRemainingC += remainingC;
            return {
                id: r.id,
                name: r.name,
                remaining: fromCents(remainingC),
                paid: fromCents(paidC),
                monthlyPayment: fromCents(paymentCents),
                installments: r.installments,
                // Cuotas COMPLETAS (floor): un pago parcial no cuenta como
                // cuota — misma regla que toLoanDto en loans.controller.
                installmentsPaid: paymentCents > 0 ? Math.floor(paidC / paymentCents) : 0
            };
        });

        // Huérfanos: agregado sin GROUP BY → siempre exactamente 1 fila
        // (SUM NULL → 0 cuando no hay huérfanos).
        const orphansRow = orphansRes.rows[0] || {};
        const orphansIncomeC = Number(orphansRow.income_c) || 0;
        const orphansExpenseC = Number(orphansRow.expense_c) || 0;

        res.json({
            accountsTotal: fromCents(accountsTotalC),
            cardsUsed: fromCents(cardsUsedC),
            loansRemaining: fromCents(loansRemainingC),
            netWorth: fromCents(accountsTotalC - cardsUsedC - loansRemainingC),
            accounts,
            cards,
            loans,
            orphans: {
                count: Number(orphansRow.n) || 0,
                net: fromCents(orphansIncomeC - orphansExpenseC)
            }
        });
    } catch (err) {
        logger.error({ err }, '[GET /overview] Error al calcular el resumen financiero');
        res.status(500).json({ error: 'Failed to calculate overview' });
    }
};
