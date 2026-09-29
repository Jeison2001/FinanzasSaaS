/**
 * Smoke test de PRODUCCIÓN — verificación post-despliegue.
 * Ejecutar: node server/prod-smoke.mjs  (o PROD_URL=https://staging... node server/prod-smoke.mjs)
 * Crea un usuario temporal (smoketest_prod_*), verifica el flujo completo de
 * entidades contra la API de producción y lo elimina al finalizar.
 * Modelo de préstamo verificado: remaining = total a pagar (cuota × cuotas) − pagado, acotado a 0.
 */
import 'dotenv/config';

const BASE = (process.env.PROD_URL || 'https://finanzassaas.onrender.com') + '/api';
const EMAIL = `smoketest_prod_${Date.now()}@finanzassaa.dev`;

let failures = 0;
const check = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`);
    else { failures++; console.log(`  ❌ ${name} ${extra}`); }
};

const api = async (path, opts = {}, token) => {
    const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) }
    });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() };
};

const { default: db } = await import('./db.js');

try {
    console.log('1) REGISTRO EN PRODUCCIÓN');
    const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'prodtest123', currency: 'MXN' }) });
    check('register 200', reg.status === 200, `(${reg.status})`);
    const token = reg.body.token;
    const userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).id;

    console.log('2) CUENTA + SALDO DERIVADO');
    const acc = await api('/accounts', { method: 'POST', body: JSON.stringify({ name: 'Cuenta Prod', initial_amount: 1000 }) }, token);
    check('crear cuenta 201', acc.status === 200 || acc.status === 201, `(${acc.status})`);
    const accId = acc.body.id ?? acc.body.account?.id;
    await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 500, description: 'Ingreso prod', date: '2026-09-29', status: 'completed', accountId: accId }) }, token);
    const accs = await api('/accounts', {}, token);
    check('saldo derivado 1500 (1000 inicial + 500 ingreso)', accs.body[0]?.balance === 1500, JSON.stringify(accs.body));

    console.log('3) OVERVIEW: PATRIMONIO NETO');
    let ov = await api('/overview', {}, token);
    check('overview 200', ov.status === 200);
    check('netWorth 1500', ov.body.netWorth === 1500, JSON.stringify(ov.body));

    console.log('4) HUÉRFANOS + ADOPCIÓN');
    await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_others', amount: 300, description: 'Histórico sin cuenta', date: '2026-09-28', status: 'completed' }) }, token);
    ov = await api('/overview', {}, token);
    check('orphans.count 1 y net 300', ov.body.orphans?.count === 1 && ov.body.orphans?.net === 300, JSON.stringify(ov.body.orphans));
    const adopt = await api(`/accounts/${accId}/adopt-orphans`, { method: 'POST' }, token);
    check('adopt-orphans 200', adopt.status === 200, `(${adopt.status})`);
    check('asignó 1 movimiento, neto 300', adopt.body.assigned === 1 && Math.abs(adopt.body.net - 300) < 0.001, JSON.stringify(adopt.body));
    ov = await api('/overview', {}, token);
    check('orphans 0 tras adoptar', ov.body.orphans?.count === 0, JSON.stringify(ov.body.orphans));
    const accs2 = await api('/accounts', {}, token);
    check('saldo tras adoptar 1800 (1500 + 300)', accs2.body[0]?.balance === 1800, JSON.stringify(accs2.body));

    console.log('5) TARJETA: COMPRA + PAGO DERIVADOS');
    const card = await api('/cards', { method: 'POST', body: JSON.stringify({ name: 'Tarjeta Prod', limit_amount: 5000, cut_day: 15, min_payment_pct: 5 }) }, token);
    check('crear tarjeta 201', card.status === 200 || card.status === 201, `(${card.status})`);
    const cardId = card.body.id ?? card.body.card?.id;
    await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'card_purchase', category: 'cat_food', amount: 805, description: 'Compra prod', date: '2026-09-29', status: 'completed', cardId }) }, token);
    let cards = await api('/cards', {}, token);
    check('usado derivado 805', cards.body[0]?.used === 805, JSON.stringify(cards.body));
    await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'card_payment', category: 'cat_others', amount: 305, description: 'Pago prod', date: '2026-09-29', status: 'completed', cardId, accountId: accId }) }, token);
    cards = await api('/cards', {}, token);
    check('usado tras pago 500', cards.body[0]?.used === 500, JSON.stringify(cards.body));

    console.log('6) PRÉSTAMO: MODO CUOTA → TASA IMPLÍCITA + MODELO TOTAL−PAGADO');
    const loan = await api('/loans', { method: 'POST', body: JSON.stringify({ name: 'Préstamo Prod', principal_amount: 10000, installments: 12, monthly_payment_amount: 1000 }) }, token);
    check('crear préstamo por cuota 201', loan.status === 200 || loan.status === 201, `(${loan.status})`);
    const loanId = loan.body.id ?? loan.body.loan?.id;
    check('remaining al crear = total (12000)', loan.body.remaining === 12000, JSON.stringify(loan.body));
    const loans0 = await api('/loans', {}, token);
    check('tasa implícita ≈ 35.07% (bisección en producción)', Math.abs(loans0.body[0]?.annual_rate_pct - 35.07) < 0.1, `(obtuvo ${loans0.body[0]?.annual_rate_pct})`);
    await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'loan_payment', category: 'cat_others', amount: 1000, description: 'Abono prod', date: '2026-09-29', status: 'completed', loanId, accountId: accId }) }, token);
    const loans2 = await api('/loans', {}, token);
    check('pagado 1000 / restante 11000 (total 12000 − 1000)', loans2.body[0]?.paid === 1000 && loans2.body[0]?.remaining === 11000, JSON.stringify(loans2.body));

    console.log('7) COHERENCIA FINAL: PATRIMONIO = CUENTAS − TARJETAS − PRÉSTAMOS');
    const accsF = await api('/accounts', {}, token);
    ov = await api('/overview', {}, token);
    const expectedNet = accsF.body[0].balance - 500 - 11000;
    check(`netWorth ${expectedNet} (coherente)`, Math.abs(ov.body.netWorth - expectedNet) < 0.01, `(obtuvo ${ov.body.netWorth})`);

    // ── Limpieza del usuario de prueba de producción ──
    for (const sql of [
        'DELETE FROM transactions WHERE user_id = ?', 'DELETE FROM budgets WHERE user_id = ?',
        'DELETE FROM user_notifications WHERE user_id = ?', 'DELETE FROM user_settings WHERE user_id = ?',
        'DELETE FROM accounts WHERE user_id = ?', 'DELETE FROM credit_cards WHERE user_id = ?',
        'DELETE FROM loans WHERE user_id = ?', 'DELETE FROM password_reset_tokens WHERE user_id = ?',
        'DELETE FROM users WHERE id = ?'
    ]) {
        await db.execute(sql, [userId]);
    }
    console.log('  🧹 usuario de prueba de producción eliminado');
} catch (err) {
    failures++;
    console.error('❌ EXCEPCIÓN:', err.message);
}
console.log(failures === 0 ? '\n✅ SMOKE DE PRODUCCIÓN — 0 fallos' : `\n❌ SMOKE DE PRODUCCIÓN — ${failures} fallo(s)`);
process.exit(failures === 0 ? 0 : 1);
