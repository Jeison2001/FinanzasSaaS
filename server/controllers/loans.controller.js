import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { toCents, fromCents } from '../utils/money.utils.js';
import { monthlyPaymentCents, impliedAnnualRatePct } from '../utils/loan.utils.js';
import { getLoanPaid } from '../services/entities.service.js';

/**
 * CRUD de préstamos. monthly_payment_cents y annual_rate_pct quedan fijados
 * en creación/edición (uno dado, el otro calculado con loan.utils); lo
 * pagado NUNCA se almacena: se deriva de transactions (loan_payment,
 * completados). remaining = principal_cents − pagado.
 */

/**
 * Recalcula el par (tasa, cuota) en céntimos a partir de un modo explícito:
 * 'rate' → cuota desde tasa; 'payment' → tasa implícita desde cuota
 * (rechaza cuota×n < principal: ni cubre el capital). Devuelve
 * { ok: true, ratePct, paymentCents } o { ok: false, error }.
 */
const resolveLoanTerms = (mode, principalCents, installments, ratePct, paymentCents) => {
    if (mode === 'payment') {
        if (paymentCents * installments < principalCents) {
            return { ok: false, error: 'Monthly payment does not cover the principal within the given installments (payment × n < principal)' };
        }
        return { ok: true, ratePct: impliedAnnualRatePct(principalCents, installments, paymentCents), paymentCents };
    }
    return { ok: true, ratePct: ratePct, paymentCents: monthlyPaymentCents(principalCents, ratePct, installments) };
};

const toLoanDto = (row, paidCents) => {
    const principalCents = Number(row.principal_cents) || 0;
    const paymentCents = Number(row.monthly_payment_cents) || 0;
    const paid = paidCents || 0;
    return {
        id: row.id,
        name: row.name,
        principal_amount: fromCents(principalCents),
        annual_rate_pct: row.annual_rate_pct,
        installments: row.installments,
        monthly_payment_amount: fromCents(paymentCents),
        paid: fromCents(paid),
        remaining: fromCents(principalCents - paid),
        // Cuotas COMPLETAS abonadas: floor no sobreestima pagos parciales
        // (media cuota no cuenta como cuota) y respeta la tolerancia al céntimo
        // cuando la cuota divide exacto (p.ej. 88849 × 3 = 266547 → 3).
        installmentsPaid: paymentCents > 0 ? Math.floor(paid / paymentCents) : 0,
        created_at: row.created_at
    };
};

export const getLoans = async (req, res) => {
    const userId = req.user.id;
    try {
        const [loansRes, paid] = await Promise.all([
            db.execute({
                sql: 'SELECT * FROM loans WHERE user_id = ? ORDER BY created_at, id',
                args: [userId]
            }),
            getLoanPaid(userId)
        ]);
        res.json(loansRes.rows.map(r => toLoanDto(r, paid.get(r.id))));
    } catch (err) {
        logger.error({ err }, '[GET /loans] Error al listar préstamos');
        res.status(500).json({ error: 'Failed to fetch loans' });
    }
};

export const createLoan = async (req, res) => {
    const userId = req.user.id;
    const { name, principal_amount, installments, annual_rate_pct, monthly_payment_amount } = req.body;
    const id = uuidv4();

    try {
        const principalCents = toCents(principal_amount);
        // El schema XOR garantiza exactamente una de las dos: si viene cuota
        // el modo es 'payment' (tasa implícita); si viene tasa, 'rate'.
        const terms = resolveLoanTerms(
            monthly_payment_amount !== undefined ? 'payment' : 'rate',
            principalCents, installments, annual_rate_pct, monthly_payment_amount !== undefined ? toCents(monthly_payment_amount) : 0
        );
        if (!terms.ok) return res.status(400).json({ error: terms.error });

        await db.execute({
            sql: 'INSERT INTO loans (id, user_id, name, principal_cents, annual_rate_pct, installments, monthly_payment_cents) VALUES (?, ?, ?, ?, ?, ?, ?)',
            args: [id, userId, name, principalCents, terms.ratePct, installments, terms.paymentCents]
        });

        res.status(201).json(toLoanDto({
            id, name, principal_cents: principalCents,
            annual_rate_pct: terms.ratePct,
            installments, monthly_payment_cents: terms.paymentCents
        }, 0));
    } catch (err) {
        logger.error({ err }, '[POST /loans] Error al crear préstamo');
        res.status(500).json({ error: 'Failed to create loan' });
    }
};

export const updateLoan = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, principal_amount, installments, annual_rate_pct, monthly_payment_amount } = req.body;

    try {
        const found = await db.execute({
            sql: 'SELECT * FROM loans WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (found.rows.length === 0) return res.status(404).json({ error: 'Loan not found' });
        const old = found.rows[0];

        // El par (tasa, cuota) SOLO se recalcula si el payload toca términos
        // (principal, plazos, tasa o cuota). Un PUT que no los toca (p.ej. solo
        // el nombre) conserva los valores almacenados EXACTOS: recalcular la
        // cuota desde la tasa implícita redondeada a 2 decimales (loan.utils)
        // introduciría drift en la cuota pactada (p.ej. 100000 → 99998 céntimos).
        const termsTouched =
            principal_amount !== undefined ||
            installments !== undefined ||
            annual_rate_pct !== undefined ||
            monthly_payment_amount !== undefined;

        let mergedPrincipalCents = Number(old.principal_cents) || 0;
        let mergedInstallments = old.installments;
        let mergedRate = Number(old.annual_rate_pct);
        let paymentCents = Number(old.monthly_payment_cents) || 0;

        if (termsTouched) {
            // Merge parcial y recálculo con la misma regla de creación: si el
            // payload trae cuota explícita manda el modo 'payment'; si trae tasa
            // (o solo cambia principal/plazos) se recalcula la cuota desde la tasa.
            mergedPrincipalCents = principal_amount !== undefined ? toCents(principal_amount) : mergedPrincipalCents;
            mergedInstallments = installments !== undefined ? installments : mergedInstallments;
            mergedRate = annual_rate_pct !== undefined ? annual_rate_pct : mergedRate;

            const terms = resolveLoanTerms(
                monthly_payment_amount !== undefined ? 'payment' : 'rate',
                mergedPrincipalCents, mergedInstallments, mergedRate,
                monthly_payment_amount !== undefined ? toCents(monthly_payment_amount) : 0
            );
            if (!terms.ok) return res.status(400).json({ error: terms.error });
            mergedRate = terms.ratePct;
            paymentCents = terms.paymentCents;
        }

        const updatedName = name !== undefined ? name : old.name;

        await db.execute({
            sql: 'UPDATE loans SET name = ?, principal_cents = ?, annual_rate_pct = ?, installments = ?, monthly_payment_cents = ? WHERE id = ? AND user_id = ?',
            args: [updatedName, mergedPrincipalCents, mergedRate, mergedInstallments, paymentCents, id, userId]
        });

        const paid = await getLoanPaid(userId);
        res.json(toLoanDto({
            id, name: updatedName, principal_cents: mergedPrincipalCents,
            annual_rate_pct: mergedRate, installments: mergedInstallments,
            monthly_payment_cents: paymentCents
        }, paid.get(id)));
    } catch (err) {
        logger.error({ err }, '[PUT /loans] Error al actualizar préstamo');
        res.status(500).json({ error: 'Failed to update loan' });
    }
};

export const deleteLoan = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const found = await db.execute({
            sql: 'SELECT id FROM loans WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (found.rows.length === 0) return res.status(404).json({ error: 'Loan not found' });

        // Atómico: borrar el préstamo Y sus movimientos (loan_payment).
        const sqlTx = await db.transaction('write');
        try {
            const movements = await sqlTx.execute({
                sql: 'DELETE FROM transactions WHERE user_id = ? AND loan_id = ?',
                args: [userId, id]
            });
            await sqlTx.execute({
                sql: 'DELETE FROM loans WHERE id = ? AND user_id = ?',
                args: [id, userId]
            });
            await sqlTx.commit();
            res.json({ success: true, deletedMovements: movements.rowsAffected });
        } catch (txErr) {
            await sqlTx.rollback();
            throw txErr;
        }
    } catch (err) {
        logger.error({ err }, '[DELETE /loans] Error al eliminar préstamo');
        res.status(500).json({ error: 'Failed to delete loan' });
    }
};
