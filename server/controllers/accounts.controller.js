import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { toCents, fromCents } from '../utils/money.utils.js';
import { getAccountFlows } from '../services/entities.service.js';

/**
 * CRUD de cuentas. El saldo NUNCA se almacena: initial_cents es un parámetro
 * de la entidad y el movimiento neto se deriva por agregación de transactions
 * (getAccountFlows, GROUP BY sin N+1). Todo el dinero entra/sale en unidades
 * de moneda por la API y en céntimos en la BD.
 */

const toAccountDto = (row, flowCents) => ({
    id: row.id,
    name: row.name,
    initial_amount: fromCents(row.initial_cents),
    balance: fromCents((Number(row.initial_cents) || 0) + (flowCents || 0)),
    created_at: row.created_at
});

export const getAccounts = async (req, res) => {
    const userId = req.user.id;
    try {
        const [accountsRes, flows] = await Promise.all([
            db.execute({
                sql: 'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at, id',
                args: [userId]
            }),
            getAccountFlows(userId)
        ]);
        res.json(accountsRes.rows.map(r => toAccountDto(r, flows.get(r.id))));
    } catch (err) {
        logger.error({ err }, '[GET /accounts] Error al listar cuentas');
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
};

export const createAccount = async (req, res) => {
    const userId = req.user.id;
    const { name, initial_amount } = req.body;
    const id = uuidv4();

    try {
        await db.execute({
            sql: 'INSERT INTO accounts (id, user_id, name, initial_cents) VALUES (?, ?, ?, ?)',
            args: [id, userId, name, toCents(initial_amount)]
        });
        res.status(201).json(toAccountDto({ id, name, initial_cents: toCents(initial_amount) }, 0));
    } catch (err) {
        logger.error({ err }, '[POST /accounts] Error al crear cuenta');
        res.status(500).json({ error: 'Failed to create account' });
    }
};

export const updateAccount = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, initial_amount } = req.body;

    try {
        const found = await db.execute({
            sql: 'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (found.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

        // Merge parcial: el campo ausente conserva el valor existente.
        const updatedName = name !== undefined ? name : found.rows[0].name;
        const updatedInitialCents = initial_amount !== undefined ? toCents(initial_amount) : Number(found.rows[0].initial_cents) || 0;

        await db.execute({
            sql: 'UPDATE accounts SET name = ?, initial_cents = ? WHERE id = ? AND user_id = ?',
            args: [updatedName, updatedInitialCents, id, userId]
        });

        const flows = await getAccountFlows(userId);
        res.json(toAccountDto({ id, name: updatedName, initial_cents: updatedInitialCents }, flows.get(id)));
    } catch (err) {
        logger.error({ err }, '[PUT /accounts] Error al actualizar cuenta');
        res.status(500).json({ error: 'Failed to update account' });
    }
};

export const deleteAccount = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const found = await db.execute({
            sql: 'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        if (found.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

        // Atómico: borrar la cuenta Y sus movimientos (como cuenta origen o
        // destino de transferencia) en una sola transacción BD.
        const sqlTx = await db.transaction('write');
        try {
            const movements = await sqlTx.execute({
                sql: 'DELETE FROM transactions WHERE user_id = ? AND (account_id = ? OR transfer_account_id = ?)',
                args: [userId, id, id]
            });
            await sqlTx.execute({
                sql: 'DELETE FROM accounts WHERE id = ? AND user_id = ?',
                args: [id, userId]
            });
            await sqlTx.commit();
            res.json({ success: true, deletedMovements: movements.rowsAffected });
        } catch (txErr) {
            await sqlTx.rollback();
            throw txErr;
        }
    } catch (err) {
        logger.error({ err }, '[DELETE /accounts] Error al eliminar cuenta');
        res.status(500).json({ error: 'Failed to delete account' });
    }
};
