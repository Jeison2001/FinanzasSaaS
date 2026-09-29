import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { toCents, fromCents } from '../utils/money.utils.js';
import { getCardUsage } from '../services/entities.service.js';

/**
 * CRUD de tarjetas de crédito. El 'usado' NUNCA se almacena: se deriva de
 * transactions (card_purchase − card_payment, completados). limit_cents,
 * cut_day y min_payment_pct son parámetros de la entidad. Pago mínimo
 * derivado = usado × min_payment_pct / 100 (0 si el usado es negativo,
 * p.ej. tras un sobrepago).
 */

const toCardDto = (row, usedCents) => {
    const used = usedCents || 0;
    const limitCents = Number(row.limit_cents) || 0;
    return {
        id: row.id,
        name: row.name,
        limit_amount: fromCents(limitCents),
        cut_day: row.cut_day,
        min_payment_pct: row.min_payment_pct,
        used: fromCents(used),
        available: fromCents(limitCents - used),
        minPayment: fromCents(Math.round(Math.max(used, 0) * (Number(row.min_payment_pct) || 0) / 100)),
        created_at: row.created_at
    };
};

export const getCards = async (req, res) => {
    const userId = req.user.id;
    try {
        const [cardsRes, usage] = await Promise.all([
            db.execute({
                sql: 'SELECT * FROM credit_cards WHERE user_id = ? ORDER BY created_at, id',
                args: [userId]
            }),
            getCardUsage(userId)
        ]);
        res.json(cardsRes.rows.map(r => toCardDto(r, usage.get(r.id))));
    } catch (err) {
        logger.error({ err }, '[GET /cards] Error al listar tarjetas');
        res.status(500).json({ error: 'Failed to fetch cards' });
    }
};

export const createCard = async (req, res) => {
    const userId = req.user.id;
    const { name, limit_amount, cut_day, min_payment_pct } = req.body;
    const id = uuidv4();

    try {
        await db.execute({
            sql: 'INSERT INTO credit_cards (id, user_id, name, limit_cents, cut_day, min_payment_pct) VALUES (?, ?, ?, ?, ?, ?)',
            args: [id, userId, name, toCents(limit_amount), cut_day, min_payment_pct]
        });
        res.status(201).json(toCardDto({ id, name, limit_cents: toCents(limit_amount), cut_day, min_payment_pct }, 0));
    } catch (err) {
        logger.error({ err }, '[POST /cards] Error al crear tarjeta');
        res.status(500).json({ error: 'Failed to create card' });
    }
};

export const updateCard = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, limit_amount, cut_day, min_payment_pct } = req.body;

    try {
        const found = await db.execute({
            sql: 'SELECT * FROM credit_cards WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (found.rows.length === 0) return res.status(404).json({ error: 'Card not found' });

        const old = found.rows[0];
        // Merge parcial: el campo ausente conserva el valor existente.
        const updatedName = name !== undefined ? name : old.name;
        const updatedLimitCents = limit_amount !== undefined ? toCents(limit_amount) : Number(old.limit_cents) || 0;
        const updatedCutDay = cut_day !== undefined ? cut_day : old.cut_day;
        const updatedMinPct = min_payment_pct !== undefined ? min_payment_pct : old.min_payment_pct;

        await db.execute({
            sql: 'UPDATE credit_cards SET name = ?, limit_cents = ?, cut_day = ?, min_payment_pct = ? WHERE id = ? AND user_id = ?',
            args: [updatedName, updatedLimitCents, updatedCutDay, updatedMinPct, id, userId]
        });

        const usage = await getCardUsage(userId);
        res.json(toCardDto({ id, name: updatedName, limit_cents: updatedLimitCents, cut_day: updatedCutDay, min_payment_pct: updatedMinPct }, usage.get(id)));
    } catch (err) {
        logger.error({ err }, '[PUT /cards] Error al actualizar tarjeta');
        res.status(500).json({ error: 'Failed to update card' });
    }
};

export const deleteCard = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const found = await db.execute({
            sql: 'SELECT id FROM credit_cards WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (found.rows.length === 0) return res.status(404).json({ error: 'Card not found' });

        // Atómico: borrar la tarjeta Y sus movimientos (card_purchase/card_payment).
        const sqlTx = await db.transaction('write');
        try {
            const movements = await sqlTx.execute({
                sql: 'DELETE FROM transactions WHERE user_id = ? AND card_id = ?',
                args: [userId, id]
            });
            await sqlTx.execute({
                sql: 'DELETE FROM credit_cards WHERE id = ? AND user_id = ?',
                args: [id, userId]
            });
            await sqlTx.commit();
            res.json({ success: true, deletedMovements: movements.rowsAffected });
        } catch (txErr) {
            await sqlTx.rollback();
            throw txErr;
        }
    } catch (err) {
        logger.error({ err }, '[DELETE /cards] Error al eliminar tarjeta');
        res.status(500).json({ error: 'Failed to delete card' });
    }
};
