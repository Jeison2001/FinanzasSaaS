/**
 * Tests de integración — API completa contra un server real en :3998.
 * El test levanta su propio proceso del server, ejecuta el flujo y limpia.
 * Requiere .env con credenciales Turso (las mismas del server).
 * Ejecutar: npm run test:integration
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 3998;
const BASE = `http://localhost:${PORT}/api`;
const EMAIL = `inttest_${Date.now()}@finanzassaa.dev`;

let serverProc = null;
let token = null;
let userId = null;

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
            // Cualquier respuesta HTTP (aunque sea 404/405) = server arriba
            const res = await fetch(`${BASE}/auth/login`, { method: 'GET' });
            if (res.status > 0) return true;
        } catch {
            // conexión rechazada — el server aún está arrancando
        }
        await new Promise(r => setTimeout(r, 400));
    }
    return false;
};

before(async () => {
    serverProc = spawn(process.execPath, ['server/index.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    // Forward de logs del server hijo para diagnosticar crashes en CI/local
    serverProc.stdout.on('data', d => process.stdout.write(`[srv] ${d}`));
    serverProc.stderr.on('data', d => process.stderr.write(`[srv-err] ${d}`));
    serverProc.on('exit', (code, sig) => console.error(`[srv] EXIT code=${code} sig=${sig}`));

    const up = await waitServer();
    if (!up) {
        serverProc.kill();
        throw new Error('El server de integración no arrancó en 30s');
    }
});

after(async () => {
    // Limpieza de datos de prueba + apagado del server
    try {
        const { default: db } = await import('../db.js');
        if (userId) {
            await db.execute('DELETE FROM transactions WHERE user_id = ?', [userId]);
            await db.execute('DELETE FROM budgets WHERE user_id = ?', [userId]);
            await db.execute('DELETE FROM user_notifications WHERE user_id = ?', [userId]);
            await db.execute('DELETE FROM user_settings WHERE user_id = ?', [userId]);
            await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        }
    } catch (e) {
        console.error('cleanup error:', e.message);
    }
    if (serverProc) serverProc.kill();
});

// ── 1. AUTH ───────────────────────────────────────────────────────────
test('auth: registro con moneda → 200 y persistida', async () => {
    const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'test123456', currency: 'COP' }) });
    assert.equal(reg.status, 200);
    token = reg.body.token;
    userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).id;

    const settings = await api('/settings', {}, token);
    assert.equal(settings.body.currency, 'COP');
});

test('auth: moneda inválida → 400', async () => {
    const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: `bad_${EMAIL}`, password: 'test123456', currency: 'XYZ' }) });
    assert.equal(r.status, 400);
});

test('auth: login correcto → 200 + token funcional', async () => {
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'test123456' }) });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    const list = await api('/transactions?limit=1', {}, r.body.token);
    assert.equal(list.status, 200);
});

test('auth: credenciales incorrectas → 401', async () => {
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'wrongpass' }) });
    assert.equal(r.status, 401);
});

test('auth: endpoints protegidos sin/conn token inválido → 401', async () => {
    assert.equal((await api('/transactions')).status, 401);
    assert.equal((await api('/transactions', {}, 'token-falso')).status, 401);
    assert.equal((await api('/transactions/export')).status, 401);
});

// ── 2. TRANSACCIONES: CRUD + VALIDACIÓN ───────────────────────────────
test('tx: crear válidas → 201', async () => {
    const inc = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'income', category: 'cat_salary', amount: 2000, description: 'Nómina', date: '2026-08-05', status: 'completed' }) }, token);
    assert.equal(inc.status, 201);

    const exp = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: 500, description: 'Mercado', date: '2026-08-06', status: 'completed' }) }, token);
    assert.equal(exp.status, 201);

    const jul = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: 300, description: 'Mercado julio', date: '2026-07-20', status: 'completed' }) }, token);
    assert.equal(jul.status, 201);
});

test('tx: Zod rechaza amount negativo y fecha imposible → 400', async () => {
    const neg = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: -5, description: 'Neg', date: '2026-08-01', status: 'completed' }) }, token);
    assert.equal(neg.status, 400);

    const badDate = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_food', amount: 5, description: 'Fecha', date: '2026-13-99', status: 'completed' }) }, token);
    assert.equal(badDate.status, 400);
});

test('tx: listar devuelve {rows,total}', async () => {
    const r = await api('/transactions?limit=50', {}, token);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.rows));
    assert.equal(typeof r.body.total, 'number');
    assert.ok(r.body.total >= 3);
});

// ── 4. STATS (aquí solo existen las 3 transacciones creadas arriba — el orden importa) ──
test('stats: modo month vs all vs período vacío', async () => {
    const month = await api('/transactions/stats?mode=month', {}, token);
    assert.equal(month.body.actualIncome, 2000);
    assert.equal(month.body.actualExpense, 500);

    const all = await api('/transactions/stats?mode=all', {}, token);
    assert.equal(all.body.actualExpense, 500 + 300);
    assert.equal(all.body.lifetimeBalance, 2000 - 800);

    const empty = await api('/transactions/stats?mode=month&month=0&year=2025', {}, token);
    assert.equal(empty.body.actualIncome, 0);
});

test('tx: PUT parcial NO pierde la recurrencia (regresión del default Zod)', async () => {
    // Crear recurrente completada → genera hijo planned
    const rec = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_subs', amount: 100, description: 'Suscripción', date: '2026-08-07', status: 'completed', recurrence: 'monthly' }) }, token);
    const anchorId = rec.body.id;

    const list = await api('/transactions?limit=50', {}, token);
    const child = list.body.rows.find(t => t.series_id === anchorId && t.id !== anchorId);
    assert.ok(child, 'el hijo planned debe existir');

    // PUT parcial SOLO con status — el hijo ya es planned→completed genera siguiente
    const put = await api(`/transactions/${child.id}`, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) }, token);
    assert.equal(put.status, 200);
    assert.equal(put.body.recurrence, 'monthly', 'la recurrencia NO debe resetearse a none');
    assert.equal(put.body.is_modified, 1);

    // La cadena sigue viva: existe una nueva planned posterior
    const after = await api('/transactions?limit=50', {}, token);
    const nextChild = after.body.rows.find(t => t.series_id === anchorId && t.id !== anchorId && t.id !== child.id && t.status === 'planned');
    assert.ok(nextChild, 'confirmar una ocurrencia debe generar la siguiente');

    // Cleanup de la serie para los tests siguientes
    await api(`/transactions/${anchorId}`, { method: 'DELETE' }, token);
});

test('tx: borrar inexistente → 404', async () => {
    const r = await api('/transactions/00000000-0000-0000-0000-000000000000', { method: 'DELETE' }, token);
    assert.equal(r.status, 404);
});

// ── 3. FILTROS SERVER-SIDE ────────────────────────────────────────────
test('filtros: type, status, mes/año y rango aplican en SQL', async () => {
    const byType = await api('/transactions?type=income', {}, token);
    assert.ok(byType.body.rows.every(t => t.type === 'income'));

    const byMonth = await api('/transactions?month=6&year=2026', {}, token);
    assert.ok(byMonth.body.rows.every(t => t.date.startsWith('2026-07')));
    assert.ok(byMonth.body.rows.length >= 1);

    const byRange = await api('/transactions?startDate=2026-08-01&endDate=2026-08-31', {}, token);
    assert.ok(byRange.body.rows.every(t => t.date >= '2026-08-01' && t.date <= '2026-08-31'));

    const all = await api('/transactions?limit=1&offset=0', {}, token);
    assert.ok(byType.body.total < all.body.total, 'total filtrado < total global');
});

test('filtros: búsqueda con comodines % _ es literal (no patrón)', async () => {
    // Crear transacción con % en la descripción
    await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_others', amount: 10, description: 'Descuento 50% off', date: '2026-08-08', status: 'completed' }) }, token);

    // Buscar "50% off" debe encontrarla (el % es literal, no comodín)
    const r = await api(`/transactions?search=${encodeURIComponent('50% off')}`, {}, token);
    assert.ok(r.body.rows.some(t => t.description === 'Descuento 50% off'));

    // Una búsqueda con % solo debe devolver lo que contenga % literal
    const wildcard = await api(`/transactions?search=${encodeURIComponent('%')}`, {}, token);
    assert.ok(wildcard.body.rows.length >= 1);
    assert.ok(wildcard.body.rows.every(t => t.description.includes('%')), 'no debe matchear descripciones sin %');
});

test('filtros: paginación consistente con total', async () => {
    const p1 = await api('/transactions?limit=2&offset=0', {}, token);
    assert.equal(p1.body.rows.length, 2);
    const p2 = await api('/transactions?limit=2&offset=2', {}, token);
    assert.equal(p1.body.total, p2.body.total);
    // Sin solapamiento entre páginas
    const ids1 = new Set(p1.body.rows.map(t => t.id));
    assert.ok(!p2.body.rows.some(t => ids1.has(t.id)));
});

// ── 5. PRESUPUESTOS ───────────────────────────────────────────────────
test('budgets: guardar y leer; month inválido → 400', async () => {
    const put = await api('/budgets', { method: 'PUT', body: JSON.stringify({ month: 7, year: 2026, items: [{ category: 'cat_food', amount: 300 }, { category: 'cat_transport', amount: 0 }] }) }, token);
    assert.equal(put.status, 200);

    const get = await api('/budgets?month=7&year=2026', {}, token);
    assert.ok(get.body.some(b => b.category === 'cat_food' && b.amount === 300));
    assert.ok(!get.body.some(b => b.category === 'cat_transport'), 'amount 0 no se persiste');

    const bad = await api('/budgets', { method: 'PUT', body: JSON.stringify({ month: 15, year: 2026, items: [] }) }, token);
    assert.equal(bad.status, 400);
});

// ── 6. REPORTES ───────────────────────────────────────────────────────
test('reports: categorías, período anterior y trend sin planned', async () => {
    const r = await api('/transactions/reports?month=7&year=2026', {}, token);
    assert.equal(r.body.expensesByCategory.cat_food, 500);
    assert.ok('prevExpensesByCategory' in r.body);
    assert.ok('prevIncomesBySource' in r.body);
    const aug = r.body.trendData.find(m => m.name === '2026-08');
    assert.ok(aug, 'agosto presente en trend');
    assert.equal(aug.expenses, 500 + 10);
});

// ── 7. CSV ────────────────────────────────────────────────────────────
test('csv: export escapa comas y comillas; import las parsea de vuelta', async () => {
    // Descripción con coma y comilla dobles — casos límite del CSV
    await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_others', amount: 20, description: 'Cena "especial", con amigos', date: '2026-08-09', status: 'completed' }) }, token);

    // BOM UTF-8 se verifica en bytes crudos (res.text() lo consume al decodificar)
    const rawExp = await fetch(`${BASE}/transactions/export`, { headers: { Authorization: `Bearer ${token}` } });
    const bytes = new Uint8Array(await rawExp.arrayBuffer());
    assert.ok(bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF, 'el CSV debe llevar BOM UTF-8 (EF BB BF) para Excel');
    const exp = await api('/transactions/export', {}, token);
    assert.equal(exp.status, 200);
    assert.ok(exp.body.includes('"Cena ""especial"", con amigos"'), 'el export debe envolver en comillas y duplicar las internas');

    // Import con una fila válida (comas dentro de comillas) + una inválida
    const imp = await api('/transactions/import', {
        method: 'POST',
        body: JSON.stringify({
            csv: 'date,type,category,amount,description,status,recurrence\n' +
                 '2026-08-05,expense,cat_transport,25,"Bus, metro y tren",completed,none\n' +
                 '2026-13-99,expense,badcat,25,Fecha inválida,completed,none'
        })
    }, token);
    assert.equal(imp.body.imported, 1);
    assert.equal(imp.body.errors.length, 1);

    // Verificar que la descripción con coma se importó íntegra
    const list = await api(`/transactions?search=${encodeURIComponent('Bus, metro y tren')}`, {}, token);
    assert.ok(list.body.rows.some(t => t.description === 'Bus, metro y tren'));
});

test('csv: import sin token → 401, csv vacío → 400', async () => {
    assert.equal((await api('/transactions/import', { method: 'POST', body: JSON.stringify({ csv: 'a' }) })).status, 401);
    assert.equal((await api('/transactions/import', { method: 'POST', body: JSON.stringify({ csv: '' }) }, token)).status, 400);
});

// ── 8. RECURRENCIA: OVERDUE + CANCELACIÓN ─────────────────────────────
test('recurrencia: planned vencida → overdue, nunca auto-completed', async () => {
    const { processRecurringTransactions } = await import('../services/recurrence.service.js');

    const past = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_subs', amount: 90, description: 'Alquiler', date: '2026-07-08', status: 'planned', recurrence: 'monthly' }) }, token);
    const pastId = past.body.id;

    const r = await processRecurringTransactions(userId);
    assert.ok(r.recursions >= 1);

    const list = await api('/transactions?status=overdue', {}, token);
    const overdue = list.body.rows.find(t => t.id === pastId);
    assert.ok(overdue, 'la vencida debe existir con status overdue');
    assert.equal(overdue.status, 'overdue');
});

test('recurrencia: borrar el ancla cancela la serie (sin huérfanos)', async () => {
    const rec = await api('/transactions', { method: 'POST', body: JSON.stringify({ type: 'expense', category: 'cat_subs', amount: 30, description: 'Serie a cancelar', date: '2026-08-10', status: 'completed', recurrence: 'weekly' }) }, token);
    const anchorId = rec.body.id;

    const del = await api(`/transactions/${anchorId}`, { method: 'DELETE' }, token);
    assert.equal(del.status, 200);

    const list = await api('/transactions?limit=200', {}, token);
    assert.ok(!list.body.rows.some(t => t.series_id === anchorId && t.id !== anchorId));
});

// ── 9. PERMISOS ───────────────────────────────────────────────────────
test('permisos: client no accede a admin → 403', async () => {
    const r = await api('/admin/users', {}, token);
    assert.equal(r.status, 403);
});

// ── 10. REGRESIONES DE AUDITORÍA ──────────────────────────────────────
test('overdue: editar una vencida responde 200 y conserva su estado', async () => {
    const list = await api('/transactions?status=overdue', {}, token);
    const overdue = list.body.rows[0];
    assert.ok(overdue, 'debe existir una transacción vencida del test anterior');

    const put = await api(`/transactions/${overdue.id}`, { method: 'PUT', body: JSON.stringify({ description: 'Alquiler editado' }) }, token);
    assert.equal(put.status, 200, 'editar una overdue NO debe fallar con 400');
    assert.equal(put.body.status, 'overdue', 'el estado overdue se conserva');
    assert.equal(put.body.description, 'Alquiler editado');
});

test('seguridad: reset de contraseña invalida los tokens previos (pwd_version)', async () => {
    const { v4: uuidv4 } = await import('uuid');
    const db = (await import('../db.js')).default;

    // Token de reset insertado directo en BD (evita el envío de email real)
    const resetToken = uuidv4();
    await db.execute({
        sql: 'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
        args: [resetToken, userId, new Date(Date.now() + 3600000).toISOString()]
    });

    const r = await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password: 'nuevaclave123' }) });
    assert.equal(r.status, 200);

    // El token emitido antes del reset queda invalidado
    const old = await api('/transactions?limit=1', {}, token);
    assert.equal(old.status, 401, 'el token previo al reset debe quedar invalidado');

    // Re-login con la nueva contraseña funciona
    const reLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'nuevaclave123' }) });
    assert.equal(reLogin.status, 200);
    token = reLogin.body.token;
});

test('admin: reset de usuario borra también presupuestos y es transaccional', async () => {
    const put = await api('/budgets', { method: 'PUT', body: JSON.stringify({ month: 7, year: 2026, items: [{ category: 'cat_food', amount: 250 }] }) }, token);
    assert.equal(put.status, 200);

    // Promover a admin directo en BD (el registro público no permite rol admin)
    const db = (await import('../db.js')).default;
    await db.execute("UPDATE users SET role = 'admin' WHERE id = ?", [userId]);

    const adminLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'nuevaclave123' }) });
    const adminToken = adminLogin.body.token;
    assert.equal(adminLogin.body.role, 'admin');

    const reset = await api(`/admin/users/${userId}/reset`, { method: 'POST' }, adminToken);
    assert.equal(reset.status, 200);

    // Los presupuestos del usuario reseteado deben haber desaparecido
    const budgets = await api('/budgets?month=7&year=2026', {}, token);
    assert.equal(budgets.body.length, 0, 'el reset debe borrar los presupuestos');
});
