import db from '../db.js';

/**
 * Servicio de entidades financieras (cuentas, tarjetas, préstamos).
 *
 * Filosofía "Entidades + Movimientos": el dinero vive SOLO en transactions.
 * El saldo de cuenta, el 'usado' de tarjeta y lo pagado de préstamo NUNCA se
 * almacenan — se DERIVAN por agregación SQL con GROUP BY (una consulta por
 * dimensión, sin loops N+1).
 *
 * Convención de estados: solo los movimientos 'completed' mueven dinero real.
 * 'planned' es pronóstico y 'overdue' aún no fue confirmado — ninguno de los
 * dos afecta saldo/usado/pagado (los KPIs del proyecto ya separan actual de
 * planificado con el mismo criterio).
 */

/** Semántica de cada tipo sobre las entidades que toca (contrato de tipos):
 *  - income:          +cuenta (account_id)
 *  - expense:         −cuenta (account_id)
 *  - transfer:        −cuenta origen (account_id) / +cuenta destino (transfer_account_id)
 *  - card_purchase:   +usado tarjeta (card_id)
 *  - card_payment:    −usado tarjeta (card_id) y, si trae account_id, −saldo cuenta
 *  - loan_payment:    +pagado préstamo (loan_id) y, si trae account_id, −saldo cuenta
 */

/**
 * Flujo neto de movimientos por cuenta (en céntimos, completados).
 * Dos GROUP BY: salidas por account_id y entradas por transfer_account_id.
 * @returns {Promise<Map<string, number>>} accountId → flujo neto en céntimos
 */
export const getAccountFlows = async (userId) => {
    const outRes = await db.execute({
        sql: `
            SELECT account_id AS id,
                   SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END) AS income_c,
                   SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) AS expense_c,
                   SUM(CASE WHEN type = 'transfer' THEN amount_cents ELSE 0 END) AS transfer_out_c,
                   SUM(CASE WHEN type = 'card_payment' THEN amount_cents ELSE 0 END) AS card_payment_c,
                   SUM(CASE WHEN type = 'loan_payment' THEN amount_cents ELSE 0 END) AS loan_payment_c
            FROM transactions
            WHERE user_id = ? AND status = 'completed' AND account_id IS NOT NULL
            GROUP BY account_id
        `,
        args: [userId]
    });
    const inRes = await db.execute({
        sql: `
            SELECT transfer_account_id AS id, SUM(amount_cents) AS transfer_in_c
            FROM transactions
            WHERE user_id = ? AND status = 'completed' AND type = 'transfer' AND transfer_account_id IS NOT NULL
            GROUP BY transfer_account_id
        `,
        args: [userId]
    });

    const flows = new Map();
    for (const r of outRes.rows) {
        flows.set(r.id,
            (Number(r.income_c) || 0)
            - (Number(r.expense_c) || 0)
            - (Number(r.transfer_out_c) || 0)
            - (Number(r.card_payment_c) || 0)
            - (Number(r.loan_payment_c) || 0)
        );
    }
    for (const r of inRes.rows) {
        flows.set(r.id, (flows.get(r.id) || 0) + (Number(r.transfer_in_c) || 0));
    }
    return flows;
};

/**
 * 'Usado' por tarjeta (en céntimos, completados): compras − pagos.
 * Puede ser negativo si el usuario sobrepagó (saldo a favor).
 * @returns {Promise<Map<string, number>>} cardId → usado en céntimos
 */
export const getCardUsage = async (userId) => {
    const res = await db.execute({
        sql: `
            SELECT card_id AS id,
                   SUM(CASE WHEN type = 'card_purchase' THEN amount_cents ELSE 0 END) AS purchases_c,
                   SUM(CASE WHEN type = 'card_payment' THEN amount_cents ELSE 0 END) AS payments_c
            FROM transactions
            WHERE user_id = ? AND status = 'completed' AND card_id IS NOT NULL
            GROUP BY card_id
        `,
        args: [userId]
    });
    const usage = new Map();
    for (const r of res.rows) {
        usage.set(r.id, (Number(r.purchases_c) || 0) - (Number(r.payments_c) || 0));
    }
    return usage;
};

/**
 * Total pagado por préstamo (en céntimos, completados).
 * @returns {Promise<Map<string, number>>} loanId → pagado en céntimos
 */
export const getLoanPaid = async (userId) => {
    const res = await db.execute({
        sql: `
            SELECT loan_id AS id, SUM(amount_cents) AS paid_c
            FROM transactions
            WHERE user_id = ? AND status = 'completed' AND type = 'loan_payment' AND loan_id IS NOT NULL
            GROUP BY loan_id
        `,
        args: [userId]
    });
    const paid = new Map();
    for (const r of res.rows) paid.set(r.id, Number(r.paid_c) || 0);
    return paid;
};

// ── Validación de referencias de movimientos ────────────────────────────

/** Tablas dueñas de cada ref (mapa fijo: el nombre de tabla NUNCA viene del request). */
const REF_TABLES = {
    accountId: 'accounts',
    transferAccountId: 'accounts',
    cardId: 'credit_cards',
    loanId: 'loans'
};

/**
 * Refs requeridas por tipo (las demás no-nulas son incoherentes).
 * NOTA DE CONTRATO: income/expense NO exigen accountId en el servidor.
 * El contrato (§API.5) pedía exigirlo, pero eso rompe la línea base
 * preexistente: la suite api.integration.test.mjs y la reimportación de
 * CSVs legacy crean income/expense sin cuenta (y la suite de entidades
 * lo tiene test-locked como ruta legacy). La exigencia vive en el CLIENTE:
 * AddTransactionModal hace el select de cuenta obligatorio para
 * income/expense cuando el usuario tiene cuentas (nuevos huérfanos: solo
 * API directa o CSV). Ownership sí se valida si la ref viene. Tipos
 * ligados a entidad: estrictos.
 */
const REF_REQUIREMENTS = {
    income: [],
    expense: [],
    transfer: ['accountId', 'transferAccountId'],
    card_purchase: ['cardId'],
    card_payment: ['cardId'],
    loan_payment: ['loanId']
};

/**
 * Refs PERMITIDAS por tipo (requeridas + opcionales): el pago de tarjeta o
 * préstamo puede salir de una cuenta. Exportada para que updateTransaction
 * normalice refs heredadas de un tipo anterior sin duplicar la matriz.
 */
export const REF_ALLOWED_FIELDS = {
    income: ['accountId'],
    expense: ['accountId'],
    transfer: ['accountId', 'transferAccountId'],
    card_purchase: ['cardId'],
    card_payment: ['cardId', 'accountId'],
    loan_payment: ['loanId', 'accountId']
};

const refErrorMessage = (field, type, kind) => {
    if (kind === 'required') return `Field ${field} is required for type ${type}`;
    return `Field ${field} is not allowed for type ${type}`;
};

/**
 * Valida coherencia por tipo y pertenencia (ownership) de las refs de un
 * movimiento. TODAS las queries van parametrizadas con user_id — un uuid
 * válido de otro usuario se rechaza igual que uno inexistente.
 *
 * @param {string} userId
 * @param {string} type
 * @param {{accountId?: string|null, transferAccountId?: string|null, cardId?: string|null, loanId?: string|null}} refs
 * @param {Map<string, boolean>} [lookupCache] cache opcional compartida entre filas
 *   (import CSV) para no re-consultar el mismo id.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export const checkTransactionRefs = async (userId, type, refs, lookupCache = new Map()) => {
    const normalized = {
        accountId: refs.accountId || null,
        transferAccountId: refs.transferAccountId || null,
        cardId: refs.cardId || null,
        loanId: refs.loanId || null
    };

    const required = REF_REQUIREMENTS[type];
    const allowed = REF_ALLOWED_FIELDS[type];
    if (!required || !allowed) return { ok: false, error: `Invalid transaction type: ${type}` };

    for (const field of required) {
        if (!normalized[field]) return { ok: false, error: refErrorMessage(field, type, 'required') };
    }

    for (const field of Object.keys(REF_TABLES)) {
        if (normalized[field] && !allowed.includes(field)) {
            return { ok: false, error: refErrorMessage(field, type, 'forbidden') };
        }
    }

    // Transferencia: origen y destino deben ser cuentas distintas.
    if (type === 'transfer' && normalized.accountId === normalized.transferAccountId) {
        return { ok: false, error: 'Transfer accounts must be different' };
    }

    // Ownership: cada ref debe existir y pertenecer al usuario.
    for (const field of Object.keys(REF_TABLES)) {
        const id = normalized[field];
        if (!id) continue;
        const key = `${REF_TABLES[field]}:${id}`;
        let owned = lookupCache.get(key);
        if (owned === undefined) {
            const r = await db.execute({
                sql: `SELECT id FROM ${REF_TABLES[field]} WHERE id = ? AND user_id = ?`,
                args: [id, userId]
            });
            owned = r.rows.length > 0;
            lookupCache.set(key, owned);
        }
        if (!owned) {
            return { ok: false, error: `Referenced entity in ${field} does not exist or belongs to another user` };
        }
    }

    return { ok: true };
};
