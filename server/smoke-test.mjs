/**
 * Smoke test temporal — verifica la API completa tras el refactor.
 * Ejecutar: node server/smoke-test.mjs  (con el server en :3999)
 * Al finalizar, elimina todos los datos del usuario de prueba.
 */
import 'dotenv/config';

const BASE = 'http://localhost:3999/api';
const EMAIL = `smoketest_${Date.now()}@finanzassaa.dev`;

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
    const body = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body };
};

const { default: db } = await import('./db.js');
const { processRecurringTransactions } = await import('./services/recurrence.service.js');

let userId = null;

try {
    console.log('1) REGISTRO CON MONEDA');
    const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'test123456', role: 'client', currency: 'MXN' }) });
    check('register 200', reg.status === 200, `(${reg.status})`);
    const token = reg.body.token;
    userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).id;
    console.log(`  usuario: ${EMAIL} id=${userId}`);

    const settings = await api('/settings', {}, token);
    check('moneda MXN persistida en settings', settings.body.currency === 'MXN', JSON.stringify(settings.body));

    // Moneda inválida debe ser rechazada por Zod
    const regBad = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: `bad_${EMAIL}`, password: 'test123456', currency: 'XYZ' }) });
    check('moneda inválida → 400', regBad.status === 400, `(${regBad.status})`);

    console.log('2) CREAR TRANSACCIONES');
    const tIncome = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 2000, description: 'Nómina', date: '2026-08-05', status: 'completed', recurrence: 'none' }) }, token);
    check('income 201', tIncome.status === 201, `(${tIncome.status})`);

    const tExpense = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: 500, description: 'Mercado', date: '2026-08-06', status: 'completed', recurrence: 'none' }) }, token);
    check('expense 201', tExpense.status === 201);

    const tJul = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: 300, description: 'Mercado julio', date: '2026-07-20', status: 'completed', recurrence: 'none' }) }, token);
    check('expense julio 201', tJul.status === 201);

    const tSearch = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_freelance', amount: 900, description: 'Proyecto Búsqueda Única', date: '2026-08-10', status: 'completed', recurrence: 'none' }) }, token);
    check('income buscable 201', tSearch.status === 201);

    // Recurrente completada → genera hijo planned con series_id heredado
    const tRec = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_subs', amount: 100, description: 'Suscripción', date: '2026-08-07', status: 'completed', recurrence: 'monthly' }) }, token);
    check('recurrente 201', tRec.status === 201, `(${tRec.status})`);
    const anchorId = tRec.body.id;

    const list = await api('/transactions?limit=50', {}, token);
    check('shape {rows,total}', Array.isArray(list.body.rows) && typeof list.body.total === 'number', JSON.stringify(Object.keys(list.body)));
    const anchor = list.body.rows.find(t => t.id === anchorId);
    const child = list.body.rows.find(t => t.series_id === anchorId && t.id !== anchorId);
    check('ancla tiene series_id propio', anchor && anchor.series_id === anchorId);
    check('hijo planned generado con series_id heredado', child && child.status === 'planned' && child.series_id === anchorId);

    console.log('3) STATS POR PERÍODO');
    const sMonth = await api('/transactions/stats?mode=month', {}, token);
    check('stats mes: income 2900 (2000+900)', sMonth.body.actualIncome === 2900, `(${sMonth.body.actualIncome})`);
    check('stats mes: expense 600 (500+100)', sMonth.body.actualExpense === 600, `(${sMonth.body.actualExpense})`);
    check('stats mes: lifetimeBalance 2000', sMonth.body.lifetimeBalance === 2000, `(${sMonth.body.lifetimeBalance})`);
    const sAll = await api('/transactions/stats?mode=all', {}, token);
    check('stats all: expense 900 (500+300+100)', sAll.body.actualExpense === 900, `(${sAll.body.actualExpense})`);
    const sFuture = await api('/transactions/stats?mode=month&month=0&year=2025', {}, token);
    check('stats mes vacío → ceros', sFuture.body.actualIncome === 0 && sFuture.body.actualExpense === 0);

    console.log('4) PRESUPUESTOS');
    const bPut = await api('/budgets', { method: 'PUT', body: JSON.stringify({ month: 7, year: 2026, items: [{ category: 'cat_food', amount: 300 }, { category: 'cat_transport', amount: 0 }] }) }, token);
    check('budgets PUT 200', bPut.status === 200, `(${bPut.status})`);
    const bGet = await api('/budgets?month=7&year=2026', {}, token);
    check('budgets GET: cat_food 300', bGet.body.some(b => b.category === 'cat_food' && b.amount === 300), JSON.stringify(bGet.body));
    check('budgets GET: amount 0 excluido', bGet.body.every(b => b.category !== 'cat_transport'));

    console.log('5) REPORTES CON DELTAS');
    const rep = await api('/transactions/reports?month=7&year=2026', {}, token);
    check('reports: expensesByCategory.cat_food 500', rep.body.expensesByCategory?.cat_food === 500, JSON.stringify(rep.body.expensesByCategory));
    check('reports: prevExpensesByCategory existe', 'prevExpensesByCategory' in rep.body && 'prevIncomesBySource' in rep.body);
    check('reports: trend excluye planned (mes 2026-08 = 600)', rep.body.trendData.some(m => m.name === '2026-08' && m.expenses === 600), JSON.stringify(rep.body.trendData));

    console.log('6) EXPORT CSV');
    const exp = await api('/transactions/export', {}, token);
    check('export 200 + csv', exp.status === 200 && exp.body.includes('date,type,category,amount,description,status,recurrence'), `(${exp.status})`);

    console.log('7) IMPORT CSV (fila inválida → error)');
    const imp = await api('/transactions/import', { method: 'POST', body: JSON.stringify({ csv: 'date,type,category,amount,description,status,recurrence\n2026-08-05,expense,cat_transport,25,Bus,completed,none\n2026-13-99,expense,badcat,25,Fecha inválida,completed,none\n\n2026-08-06,income,cat_freelance,150,Proyecto,completed,none' }) }, token);
    check('import: 2 ok + 1 error', imp.body.imported === 2 && imp.body.errors?.length === 1, JSON.stringify(imp.body));

    console.log('8) CONFIRMACIÓN MANUAL DE HIJO PLANNED');
    const list2 = await api('/transactions?limit=50', {}, token);
    const child2 = list2.body.rows.find(t => t.series_id === anchorId && t.id !== anchorId && t.status === 'planned');
    const conf = await api(`/transactions/${child2.id}`, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) }, token);
    check('confirmar hijo → 200', conf.status === 200, `(${conf.status})`);
    const list3 = await api('/transactions?limit=50', {}, token);
    const nextChild = list3.body.rows.find(t => t.series_id === anchorId && t.id !== anchorId && t.id !== child2.id && t.status === 'planned');
    check('confirmar hijo genera siguiente ocurrencia', !!nextChild && nextChild.date === '2026-10-07', `(${nextChild?.date})`);

    console.log('9) PURGA AL QUITAR RECURRENCIA (conserva confirmadas, purga planificadas)');
    const purge = await api(`/transactions/${anchorId}`, { method: 'PUT', body: JSON.stringify({ recurrence: 'none' }) }, token);
    check('quitar recurrencia → 200', purge.status === 200);
    const list4 = await api('/transactions?limit=50', {}, token);
    const remainingChildren = list4.body.rows.filter(t => t.series_id === anchorId && t.id !== anchorId);
    check('hijos planificados purgados, confirmadas conservadas', remainingChildren.length === 1 && remainingChildren[0].status === 'completed', JSON.stringify(remainingChildren));

    console.log('10) OVERDUE VÍA SERVICIO DE RECURRENCIA');
    const pastTx = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_subs', amount: 90, description: 'Alquiler mensual', date: '2026-07-08', status: 'planned', recurrence: 'monthly' }) }, token);
    check('planned recurrente 201', pastTx.status === 201);
    const pastId = pastTx.body.id;
    const r = await processRecurringTransactions(userId);
    check('recurrencia procesada', r.recursions >= 1, JSON.stringify(r));
    const list5 = await api('/transactions?limit=50', {}, token);
    const overdueTx = list5.body.rows.find(t => t.id === pastId);
    check('planned vencida → overdue (no completed)', overdueTx && overdueTx.status === 'overdue', JSON.stringify(overdueTx));
    const nextOfOverdue = list5.body.rows.find(t => t.series_id === pastId && t.id !== pastId && t.status === 'planned');
    check('serie viva: siguiente planned en 2026-09-08', nextOfOverdue && nextOfOverdue.date === '2026-09-08', `(${nextOfOverdue?.date})`);
    const catchupOverdue = list5.body.rows.find(t => t.series_id === pastId && t.id !== pastId && t.date === '2026-08-08');
    check('ocurrencia intermedia quedó overdue', catchupOverdue && catchupOverdue.status === 'overdue', JSON.stringify(catchupOverdue));
    const notif = await api('/notifications', {}, token);
    check('notificación generada', notif.body.some(n => n.message_key === 'notif_recurring_processed'), JSON.stringify(notif.body));

    console.log('11) CANCELAR SERIE AL BORRAR ANCLA');
    const cancelTx = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_subs', amount: 20, description: 'Serie a cancelar', date: '2026-08-10', status: 'completed', recurrence: 'weekly' }) }, token);
    const cancelAnchorId = cancelTx.body.id;
    const delAnchor = await api(`/transactions/${cancelAnchorId}`, { method: 'DELETE' }, token);
    check('borrar ancla → 200', delAnchor.status === 200);
    const list6 = await api('/transactions?limit=50', {}, token);
    const orphans = list6.body.rows.filter(t => t.series_id === cancelAnchorId && t.id !== cancelAnchorId);
    check('sin hijos huérfanos tras borrar ancla', orphans.length === 0, JSON.stringify(orphans));

    console.log('12) SKIP: borrar ocurrencia planned regenera la siguiente');
    const skipTx = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_subs', amount: 30, description: 'Serie skip', date: '2026-08-11', status: 'completed', recurrence: 'weekly' }) }, token);
    const skipAnchorId = skipTx.body.id;
    const list7 = await api('/transactions?limit=50', {}, token);
    const skipChild = list7.body.rows.find(t => t.series_id === skipAnchorId && t.id !== skipAnchorId && t.status === 'planned');
    const delChild = await api(`/transactions/${skipChild.id}`, { method: 'DELETE' }, token);
    check('borrar ocurrencia planned → 200', delChild.status === 200);
    const list8 = await api('/transactions?limit=50', {}, token);
    const regenerated = list8.body.rows.find(t => t.series_id === skipAnchorId && t.id !== skipAnchorId && t.status === 'planned');
    check('cadena viva tras skip (nueva planned)', !!regenerated && regenerated.id !== skipChild.id, JSON.stringify(regenerated?.id));

    console.log('13) LÍMITE DE PÁGINADO');
    const bigLimit = await api('/transactions?limit=999999', {}, token);
    check('limit cap 200', bigLimit.body.rows.length <= 200, `(${bigLimit.body.rows.length})`);

    console.log('14) FILTROS SERVER-SIDE');
    const fType = await api('/transactions?type=income', {}, token);
    check('filtro type=income', fType.body.rows.every(t => t.type === 'income') && fType.body.rows.length >= 3, `(${fType.body.rows.length})`);

    const fStatus = await api('/transactions?status=planned', {}, token);
    check('filtro status=planned', fStatus.body.rows.every(t => t.status === 'planned'), JSON.stringify(fStatus.body.rows.map(t => t.status)));

    const fSearch = await api(`/transactions?search=${encodeURIComponent('Búsqueda Única')}`, {}, token);
    check('búsqueda por texto', fSearch.body.rows.length === 1 && fSearch.body.rows[0].description === 'Proyecto Búsqueda Única', JSON.stringify(fSearch.body.rows));

    const fMonth = await api('/transactions?month=6&year=2026', {}, token);
    check('filtro mes=6 año=2026 (julio)', fMonth.body.rows.every(t => t.date.startsWith('2026-07')), JSON.stringify(fMonth.body.rows.map(t => t.date)));

    const fRange = await api('/transactions?startDate=2026-08-01&endDate=2026-08-31', {}, token);
    check('filtro rango agosto', fRange.body.rows.every(t => t.date >= '2026-08-01' && t.date <= '2026-08-31'), JSON.stringify(fRange.body.rows.map(t => t.date)));

    const fPaged = await api('/transactions?limit=2&offset=2', {}, token);
    check('paginación: 2 filas + total global', fPaged.body.rows.length === 2 && fPaged.body.total >= 4, `(rows=${fPaged.body.rows.length} total=${fPaged.body.total})`);

    const fTypeTotal = await api('/transactions?type=expense', {}, token);
    const allList = await api('/transactions?limit=1&offset=0', {}, token);
    check('total filtrado != total global', fTypeTotal.body.total < allList.body.total, `(exp=${fTypeTotal.body.total} all=${allList.body.total})`);

    console.log('15) INTEGRACIÓN: AUTH, PERMISOS Y VALIDACIONES');
    const noToken = await api('/transactions');
    check('sin token → 401', noToken.status === 401, `(${noToken.status})`);
    const badToken = await api('/transactions', {}, 'token-invalido');
    check('token inválido → 401', badToken.status === 401, `(${badToken.status})`);
    const badLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'wrongpass' }) });
    check('login incorrecto → 401', badLogin.status === 401, `(${badLogin.status})`);
    const reLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'test123456' }) });
    check('login correcto → 200 + token', reLogin.status === 200 && !!reLogin.body.token, `(${reLogin.status})`);
    const reList = await api('/transactions?limit=5', {}, reLogin.body.token);
    check('token de login sirve para listar', reList.status === 200 && Array.isArray(reList.body.rows), `(${reList.status})`);

    const adminDenied = await api('/admin/users', {}, token);
    check('admin con rol client → 403', adminDenied.status === 403, `(${adminDenied.status})`);

    const negAmount = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: -5, description: 'Negativo', date: '2026-08-01', status: 'completed' }) }, token);
    check('amount negativo → 400 (Zod)', negAmount.status === 400, `(${negAmount.status})`);
    const badDate = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: 5, description: 'Fecha imposible', date: '2026-13-99', status: 'completed' }) }, token);
    check('fecha imposible → 400 (Zod)', badDate.status === 400, `(${badDate.status})`);
    const del404 = await api('/transactions/00000000-0000-0000-0000-000000000000', { method: 'DELETE' }, token);
    check('borrar inexistente → 404', del404.status === 404, `(${del404.status})`);
    const badLang = await api('/settings', { method: 'PUT', body: JSON.stringify({ savings_goal: 100, currency: 'EUR', language: 'fr' }) }, token);
    check('language inválido → 400 (Zod)', badLang.status === 400, `(${badLang.status})`);
    const badBudgetMonth = await api('/budgets', { method: 'PUT', body: JSON.stringify({ month: 15, year: 2026, items: [] }) }, token);
    check('budget month 15 → 400 (Zod)', badBudgetMonth.status === 400, `(${badBudgetMonth.status})`);
    const expNoToken = await api('/transactions/export');
    check('export sin token → 401', expNoToken.status === 401, `(${expNoToken.status})`);
    const impNoToken = await api('/transactions/import', { method: 'POST', body: JSON.stringify({ csv: 'a' }) });
    check('import sin token → 401', impNoToken.status === 401, `(${impNoToken.status})`);
    const emptyCsv = await api('/transactions/import', { method: 'POST', body: JSON.stringify({ csv: '' }) }, token);
    check('import csv vacío → 400 (Zod)', emptyCsv.status === 400, `(${emptyCsv.status})`);

} catch (err) {
    failures++;
    console.error('❌ EXCEPCIÓN EN SMOKE TEST:', err.message);
} finally {
    // ── Limpieza completa del usuario de prueba (userId ya capturado, sin re-login) ──
    if (userId) {
        await db.execute('DELETE FROM transactions WHERE user_id = ?', [userId]);
        await db.execute('DELETE FROM budgets WHERE user_id = ?', [userId]);
        await db.execute('DELETE FROM user_notifications WHERE user_id = ?', [userId]);
        await db.execute('DELETE FROM user_settings WHERE user_id = ?', [userId]);
        await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        console.log('  🧹 datos de prueba eliminados');
    }
    console.log(failures === 0 ? '\n✅ SMOKE TEST COMPLETO — 0 fallos' : `\n❌ SMOKE TEST — ${failures} fallo(s)`);
    process.exit(failures === 0 ? 0 : 1);
}
