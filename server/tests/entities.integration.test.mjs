/**
 * Tests de integración — Entidades financieras (cuentas, tarjetas, préstamos)
 * y su interacción con los movimientos. Server real en :3999, usuario propio
 * (A) + usuario ajeno (B) para los casos de seguridad, cleanup en after.
 * Requiere .env con credenciales Turso (las mismas del server).
 * Ejecutar: node --test server/tests/entities.integration.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { impliedAnnualRatePct } from '../utils/loan.utils.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 3999;
const BASE = `http://localhost:${PORT}/api`;
const EMAIL_A = `enttestA_${Date.now()}@finanzassaa.dev`;
const EMAIL_B = `enttestB_${Date.now()}@finanzassaa.dev`;

let serverProc = null;
let token = null;       // usuario A
let tokenB = null;      // usuario B (entidades ajenas)
let userId = null;
let userIdB = null;

// Entidades del usuario A
let acc1 = null, acc2 = null, card1 = null, loan1 = null, loan2 = null;
// Entidades del usuario B
let accB = null, cardB = null;

const api = async (path, opts = {}, authToken) => {
    const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...(opts.headers || {})
        }
    });
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body, headers: res.headers };
};

const waitServer = async (ms = 30000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
        try {
            const res = await fetch(`${BASE}/auth/login`, { method: 'GET' });
            if (res.status > 0) return true;
        } catch {
            // conexión rechazada — el server aún está arrancando
        }
        await new Promise(r => setTimeout(r, 400));
    }
    return false;
};

const register = async (email) => {
    const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password: 'test123456' }) });
    assert.equal(r.status, 200);
    return { token: r.body.token, userId: JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url').toString()).id };
};

const getAccountBalance = async (id) => {
    const r = await api('/accounts', {}, token);
    return r.body.find(a => a.id === id)?.balance;
};

before(async () => {
    serverProc = spawn(process.execPath, ['server/index.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    serverProc.stdout.on('data', d => process.stdout.write(`[srv] ${d}`));
    serverProc.stderr.on('data', d => process.stderr.write(`[srv-err] ${d}`));
    serverProc.on('exit', (code, sig) => console.error(`[srv] EXIT code=${code} sig=${sig}`));

    const up = await waitServer();
    if (!up) {
        serverProc.kill();
        throw new Error('El server de integración no arrancó en 30s');
    }

    const a = await register(EMAIL_A);
    token = a.token; userId = a.userId;
    const b = await register(EMAIL_B);
    tokenB = b.token; userIdB = b.userId;

    // Entidades del usuario B (ajenas a A) — creadas aquí porque el test de
    // import CSV las usa como refs inválidas antes del test de seguridad.
    const accBCreated = await api('/accounts', { method: 'POST', body: JSON.stringify({ name: 'Cuenta B', initial_amount: 0 }) }, tokenB);
    assert.equal(accBCreated.status, 201);
    accB = accBCreated.body.id;
    const cardBCreated = await api('/cards', { method: 'POST', body: JSON.stringify({ name: 'Card B', limit_amount: 100 }) }, tokenB);
    assert.equal(cardBCreated.status, 201);
    cardB = cardBCreated.body.id;
});

after(async () => {
    // Limpieza de TODOS los datos de prueba (2 usuarios) + apagado del server
    try {
        const { default: db } = await import('../db.js');
        for (const uid of [userId, userIdB].filter(Boolean)) {
            await db.execute('DELETE FROM transactions WHERE user_id = ?', [uid]);
            await db.execute('DELETE FROM accounts WHERE user_id = ?', [uid]);
            await db.execute('DELETE FROM credit_cards WHERE user_id = ?', [uid]);
            await db.execute('DELETE FROM loans WHERE user_id = ?', [uid]);
            await db.execute('DELETE FROM budgets WHERE user_id = ?', [uid]);
            await db.execute('DELETE FROM user_notifications WHERE user_id = ?', [uid]);
            await db.execute('DELETE FROM user_settings WHERE user_id = ?', [uid]);
            await db.execute('DELETE FROM users WHERE id = ?', [uid]);
        }
    } catch (e) {
        console.error('cleanup error:', e.message);
    }
    if (serverProc) serverProc.kill();
});

// ── 1. CUENTAS: CRUD + saldo derivado ─────────────────────────────────
test('cuentas: crear → saldo inicial; ingreso suma y gasto resta', async () => {
    const created = await api('/accounts', { method: 'POST', body: JSON.stringify({ name: 'Cuenta principal', initial_amount: 1000 }) }, token);
    assert.equal(created.status, 201);
    assert.equal(created.body.balance, 1000);
    assert.equal(created.body.initial_amount, 1000);
    acc1 = created.body.id;

    const list = await api('/accounts', {}, token);
    assert.equal(list.status, 200);
    assert.equal(list.body.find(a => a.id === acc1)?.balance, 1000, 'el GET lista con saldo derivado');

    const inc = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 500, description: 'Nómina', date: '2026-08-05', status: 'completed', accountId: acc1 }) }, token);
    assert.equal(inc.status, 201);

    const exp = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: 200, description: 'Mercado', date: '2026-08-06', status: 'completed', accountId: acc1 }) }, token);
    assert.equal(exp.status, 201);

    assert.equal(await getAccountBalance(acc1), 1300, '1000 + 500 − 200');
});

test('cuentas: PUT recalcula con nuevo saldo inicial; validación Zod → 400', async () => {
    const put = await api(`/accounts/${acc1}`, { method: 'PUT', body: JSON.stringify({ name: 'Cuenta editada', initial_amount: 900 }) }, token);
    assert.equal(put.status, 200);
    assert.equal(put.body.balance, 1200, '900 + 500 − 200');
    assert.equal(put.body.name, 'Cuenta editada');

    const neg = await api('/accounts', { method: 'POST', body: JSON.stringify({ name: 'Negativa', initial_amount: -5 }) }, token);
    assert.equal(neg.status, 400);

    const noName = await api('/accounts', { method: 'POST', body: JSON.stringify({ initial_amount: 5 }) }, token);
    assert.equal(noName.status, 400);
});

// ── 2. TRANSFERENCIA ENTRE CUENTAS ────────────────────────────────────
test('transferencia: mueve saldo; misma cuenta / destino ajeno / incompleta → 400', async () => {
    const second = await api('/accounts', { method: 'POST', body: JSON.stringify({ name: 'Cuenta ahorro', initial_amount: 0 }) }, token);
    assert.equal(second.status, 201);
    acc2 = second.body.id;

    const tr = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'transfer', category: 'cat_transfer', amount: 300, description: 'Transferencia ahorro', date: '2026-08-07', status: 'completed', accountId: acc1, transferAccountId: acc2 }) }, token);
    assert.equal(tr.status, 201);
    assert.equal(await getAccountBalance(acc1), 900);
    assert.equal(await getAccountBalance(acc2), 300);

    const same = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'transfer', category: 'cat_transfer', amount: 10, description: 'A mí mismo', date: '2026-08-07', status: 'completed', accountId: acc1, transferAccountId: acc1 }) }, token);
    assert.equal(same.status, 400, 'origen y destino deben ser cuentas distintas');

    const incomplete = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'transfer', category: 'cat_transfer', amount: 10, description: 'Sin destino', date: '2026-08-07', status: 'completed', accountId: acc1 }) }, token);
    assert.equal(incomplete.status, 400, 'transfer exige ambas cuentas');
});

// ── 3. TARJETA: usado / disponible / pago mínimo derivados ────────────
test('tarjeta: compra suma al usado; pagos lo restan (con y sin cuenta)', async () => {
    const created = await api('/cards', { method: 'POST', body: JSON.stringify({ name: 'Visa', limit_amount: 2000, cut_day: 5, min_payment_pct: 10 }) }, token);
    assert.equal(created.status, 201);
    assert.equal(created.body.used, 0);
    card1 = created.body.id;

    const purchase = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'card_purchase', category: 'cat_shopping', amount: 600, description: 'Compra tarjeta', date: '2026-08-08', status: 'completed', cardId: card1 }) }, token);
    assert.equal(purchase.status, 201);

    let list = await api('/cards', {}, token);
    let card = list.body.find(c => c.id === card1);
    assert.equal(card.used, 600);
    assert.equal(card.available, 1400);
    assert.equal(card.minPayment, 60, '10% de 600');

    // Pago saldado desde la cuenta: baja el usado Y el saldo de la cuenta
    const payFromAccount = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'card_payment', category: 'cat_card', amount: 150, description: 'Pago tarjeta', date: '2026-08-09', status: 'completed', cardId: card1, accountId: acc1 }) }, token);
    assert.equal(payFromAccount.status, 201);
    assert.equal(await getAccountBalance(acc1), 750, '900 − 150 (el pago sale de la cuenta)');

    // Pago sin cuenta: baja el usado, no toca saldos
    const payNoAccount = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'card_payment', category: 'cat_card', amount: 50, description: 'Abono sin cuenta', date: '2026-08-09', status: 'completed', cardId: card1 }) }, token);
    assert.equal(payNoAccount.status, 201);

    list = await api('/cards', {}, token);
    card = list.body.find(c => c.id === card1);
    assert.equal(card.used, 400, '600 − 150 − 50');
    assert.equal(card.available, 1600);
    assert.equal(card.minPayment, 40);
});

test('coherencia: refs no aplicables al tipo → 400 (card_purchase con cuenta, income con tarjeta)', async () => {
    const badPurchase = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'card_purchase', category: 'cat_shopping', amount: 10, description: 'Compra rara', date: '2026-08-08', status: 'completed', cardId: card1, accountId: acc1 }) }, token);
    assert.equal(badPurchase.status, 400, 'card_purchase no toca cuentas');

    const badIncome = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 10, description: 'Ingreso raro', date: '2026-08-08', status: 'completed', accountId: acc1, cardId: card1 }) }, token);
    assert.equal(badIncome.status, 400, 'income no referencia tarjetas');

    // Legacy: un income sin cuenta sigue siendo válido (compatibilidad con
    // datos y CSVs anteriores a las entidades) — NO aterriza en ninguna cuenta.
    const before1 = await getAccountBalance(acc1);
    const orphanIncome = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 10, description: 'Sin cuenta', date: '2026-08-08', status: 'planned' }) }, token);
    assert.equal(orphanIncome.status, 201, 'income sin account_id se acepta (ruta legacy)');
    assert.equal(await getAccountBalance(acc1), before1, 'el ingreso sin cuenta no toca saldos');
});

// ── 4. PRÉSTAMOS: modo tasa y modo cuota ──────────────────────────────
test('préstamos: modo tasa (cuota = referencia externa 888.49) y modo cuota (tasa implícita)', async () => {
    const byRate = await api('/loans', { method: 'POST', body: JSON.stringify({ name: 'Préstamo coche', principal_amount: 10000, installments: 12, annual_rate_pct: 12 }) }, token);
    assert.equal(byRate.status, 201);
    assert.equal(byRate.body.monthly_payment_amount, 888.49, '10000 al 12% en 12 meses → cuota 888.49 (calculadora estándar)');
    assert.equal(byRate.body.remaining, 10000);
    assert.equal(byRate.body.paid, 0);
    assert.equal(byRate.body.installmentsPaid, 0);
    loan1 = byRate.body.id;

    const byPayment = await api('/loans', { method: 'POST', body: JSON.stringify({ name: 'Préstamo cuota', principal_amount: 10000, installments: 12, monthly_payment_amount: 1000 }) }, token);
    assert.equal(byPayment.status, 201);
    // La tasa almacenada debe ser la implícita de la matemática de préstamos
    // (loan.utils, validada contra referencia externa en loan.utils.test.mjs)
    assert.equal(byPayment.body.annual_rate_pct, impliedAnnualRatePct(1_000_000, 12, 100_000));
    assert.ok(byPayment.body.annual_rate_pct > 0, 'cuota mayor que capital/12 → tasa positiva');
    assert.equal(byPayment.body.monthly_payment_amount, 1000);
    loan2 = byPayment.body.id;
});

test('préstamos: rechazos — cuota insuficiente, ambos modos, ningún modo', async () => {
    const insufficient = await api('/loans', { method: 'POST', body: JSON.stringify({ name: 'Insuficiente', principal_amount: 10000, installments: 12, monthly_payment_amount: 500 }) }, token);
    assert.equal(insufficient.status, 400, '500×12 = 6000 < 10000: ni cubre el capital');

    const both = await api('/loans', { method: 'POST', body: JSON.stringify({ name: 'Ambos', principal_amount: 10000, installments: 12, annual_rate_pct: 5, monthly_payment_amount: 900 }) }, token);
    assert.equal(both.status, 400, 'tasa y cuota son excluyentes');

    const neither = await api('/loans', { method: 'POST', body: JSON.stringify({ name: 'Ninguno', principal_amount: 10000, installments: 12 }) }, token);
    assert.equal(neither.status, 400, 'falta tasa o cuota');
});

test('préstamos: loan_payment deriva pagado/remaining/cuotas pagadas', async () => {
    const pay = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'loan_payment', category: 'cat_loan', amount: 888.49, description: 'Cuota 1 coche', date: '2026-08-10', status: 'completed', loanId: loan1, accountId: acc1 }) }, token);
    assert.equal(pay.status, 201);
    assert.equal(await getAccountBalance(acc1), -138.49, '750 − 888.49 (la cuota sale de la cuenta)');

    const list = await api('/loans', {}, token);
    const loan = list.body.find(l => l.id === loan1);
    assert.equal(loan.paid, 888.49);
    assert.equal(loan.remaining, 9111.51, '10000 − 888.49');
    assert.equal(loan.installmentsPaid, 1);
});

// ── 5. OVERVIEW coherente ─────────────────────────────────────────────
test('overview: netWorth = cuentas − tarjetas − préstamos, con listas derivadas', async () => {
    const r = await api('/overview', {}, token);
    assert.equal(r.status, 200);
    assert.equal(r.body.accountsTotal, 161.51, '(−138.49) + 300');
    assert.equal(r.body.cardsUsed, 400);
    assert.equal(r.body.loansRemaining, 19111.51, '9111.51 + 10000');

    const expectedNet = r.body.accountsTotal - r.body.cardsUsed - r.body.loansRemaining;
    assert.ok(Math.abs(r.body.netWorth - expectedNet) < 1e-6, `netWorth ${r.body.netWorth} ≈ ${expectedNet}`);
    assert.ok(Math.abs(r.body.netWorth - (-19350)) < 1e-6);

    const acc = r.body.accounts.find(a => a.id === acc1);
    assert.equal(acc.balance, -138.49);
    const card = r.body.cards.find(c => c.id === card1);
    assert.equal(card.used, 400);
    assert.equal(card.limit, 2000);
    assert.equal(card.minPayment, 40);
    const loan = r.body.loans.find(l => l.id === loan1);
    assert.equal(loan.remaining, 9111.51);
    assert.equal(loan.monthlyPayment, 888.49);
    assert.equal(loan.installmentsPaid, 1);
});

// ── 6. CSV: export/import con refs ────────────────────────────────────
test('csv: export incluye columnas de refs; import valida pertenencia y dedupe con refs', async () => {
    const rawExp = await fetch(`${BASE}/transactions/export`, { headers: { Authorization: `Bearer ${token}` } });
    const csv = await rawExp.text();
    assert.ok(csv.includes('date,type,category,amount,description,status,recurrence,account_id,transfer_account_id,card_id,loan_id'), 'header con las 4 refs');
    const transferLine = csv.split('\n').find(l => l.includes('Transferencia ahorro'));
    assert.ok(transferLine?.includes(acc1) && transferLine?.includes(acc2), 'la fila transfer lleva origen y destino');

    const csvImport = [
        'date,type,category,amount,description,status,recurrence,account_id,transfer_account_id,card_id,loan_id',
        `2026-08-20,income,cat_salary,100,Ingreso importado,completed,none,${acc1},,,`,
        `2026-08-21,income,cat_salary,50,Ref ajena,completed,none,${accB},,,`,
        `2026-08-22,transfer,cat_transfer,50,Transfer importada,completed,none,${acc1},${acc2},,,`
    ].join('\n');

    const imp = await api('/transactions/import', { method: 'POST', body: JSON.stringify({ csv: csvImport }) }, token);
    assert.equal(imp.status, 200);
    assert.equal(imp.body.imported, 2);
    assert.equal(imp.body.errors.length, 1, 'la ref de otro usuario se reporta como error de fila');
    assert.equal(imp.body.duplicates, 0);

    assert.equal(await getAccountBalance(acc1), -88.49, '−138.49 + 100 (ingreso) − 50 (transfer)');
    assert.equal(await getAccountBalance(acc2), 350, '300 + 50');

    const again = await api('/transactions/import', { method: 'POST', body: JSON.stringify({ csv: csvImport }) }, token);
    assert.equal(again.body.imported, 0, 'reimportar no duplica');
    assert.equal(again.body.duplicates, 2, 'la clave de dedupe incluye las refs');
    assert.equal(again.body.errors.length, 1);
});

// ── 7. PUT de movimientos: mover refs y coherencia con refs explícitas ─
test('movimientos: PUT cambia la cuenta de un ingreso; ref explícita incoherente → 400', async () => {
    const before1 = await getAccountBalance(acc1);
    const before2 = await getAccountBalance(acc2);

    const tx = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 10, description: 'A mover', date: '2026-08-25', status: 'completed', accountId: acc1 }) }, token);
    assert.equal(tx.status, 201);

    const moved = await api(`/transactions/${tx.body.id}`, { method: 'PUT', body: JSON.stringify({ accountId: acc2 }) }, token);
    assert.equal(moved.status, 200);
    assert.equal(moved.body.accountId, acc2);
    assert.equal(await getAccountBalance(acc1), before1, 'el saldo original queda como estaba');
    assert.equal(await getAccountBalance(acc2), before2 + 10, 'el ingreso ahora aterriza en la otra cuenta');

    const badRef = await api(`/transactions/${tx.body.id}`, { method: 'PUT', body: JSON.stringify({ cardId: card1 }) }, token);
    assert.equal(badRef.status, 400, 'un income no puede referenciar una tarjeta');
});

// ── 8. KPIs: card_purchase cuenta como gasto; transfer/pagos no ───────
test('KPIs: stats incluyen card_purchase como gasto y excluyen transfer/card_payment/loan_payment', async () => {
    const all = await api('/transactions/stats?mode=all', {}, token);
    assert.equal(all.body.actualIncome, 610, '500 + 100 (import) + 10 (PUT)');
    assert.equal(all.body.actualExpense, 800, '200 (expense) + 600 (card_purchase)');
    assert.equal(all.body.lifetimeBalance, -190, '610 − 800');

    const month = await api('/transactions/stats?mode=month&month=7&year=2026', {}, token);
    assert.equal(month.body.actualIncome, 610);
    assert.equal(month.body.actualExpense, 800);
});

// ── 9. REPORTES: gastos por categoría y trend ─────────────────────────
test('reportes: expensesByCategory y trend cuentan card_purchase como gasto', async () => {
    const r = await api('/transactions/reports?month=7&year=2026', {}, token);
    assert.equal(r.body.expensesByCategory.cat_food, 200);
    assert.equal(r.body.expensesByCategory.cat_shopping, 600, 'card_purchase agrupa como gasto');
    assert.equal(r.body.incomesBySource.cat_salary, 610);
    const aug = r.body.trendData.find(m => m.name === '2026-08');
    assert.equal(aug.incomes, 610);
    assert.equal(aug.expenses, 800, 'trend: expense + card_purchase');
});

// ── 10. SEGURIDAD: entidades ajenas ───────────────────────────────────
test('seguridad: mover/usar/editar/borrar entidad ajena → 400/404; sin token → 401', async () => {
    const stealIncome = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 999, description: 'Robo', date: '2026-08-26', status: 'completed', accountId: accB }) }, token);
    assert.equal(stealIncome.status, 400, 'account de otro usuario → 400');

    const stealPurchase = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'card_purchase', category: 'cat_shopping', amount: 999, description: 'Robo', date: '2026-08-26', status: 'completed', cardId: cardB }) }, token);
    assert.equal(stealPurchase.status, 400, 'card de otro usuario → 400');

    const stealTransfer = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'transfer', category: 'cat_transfer', amount: 999, description: 'Robo', date: '2026-08-26', status: 'completed', accountId: acc1, transferAccountId: accB }) }, token);
    assert.equal(stealTransfer.status, 400, 'destino de otro usuario → 400');

    assert.equal((await api(`/accounts/${accB}`, { method: 'PUT', body: JSON.stringify({ name: 'Hack' }) }, token)).status, 404);
    assert.equal((await api(`/accounts/${accB}`, { method: 'DELETE' }, token)).status, 404);
    assert.equal((await api(`/cards/${cardB}`, { method: 'DELETE' }, token)).status, 404);

    const overview = await api('/overview', {}, token);
    assert.ok(!overview.body.accounts.some(a => a.id === accB), 'el overview de A no ve entidades de B');
    assert.ok(!overview.body.cards.some(c => c.id === cardB));

    assert.equal((await api('/accounts')).status, 401);
    assert.equal((await api('/overview')).status, 401);
});
