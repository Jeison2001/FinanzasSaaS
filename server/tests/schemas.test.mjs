/**
 * Tests unitarios — contratos Zod (transaction, auth, budget, password, settings).
 * Incluye la regresión crítica: updateTransactionSchema NO debe inyectar
 * defaults en actualizaciones parciales (mataba la recurrencia en PUT).
 * Ejecutar: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTransactionSchema, updateTransactionSchema, importTransactionsSchema } from '../schemas/transaction.schema.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { saveBudgetsSchema } from '../schemas/budget.schema.js';
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/password.schema.js';
import { updateSettingsSchema } from '../schemas/settings.schema.js';

const validTx = {
    type: 'expense',
    category: 'cat_food',
    amount: 50.5,
    description: 'Mercado',
    date: '2026-08-15',
    status: 'completed'
};

// ── addTransactionSchema ──────────────────────────────────────────────
test('add: transacción válida parsea y aplica default recurrence=none', () => {
    const r = addTransactionSchema.parse(validTx);
    assert.equal(r.recurrence, 'none');
    assert.equal(r.amount, 50.5);
});

test('add: amount string se colecciona a number', () => {
    const r = addTransactionSchema.parse({ ...validTx, amount: '99.99' });
    assert.equal(r.amount, 99.99);
});

test('add: amount negativo rechazado', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, amount: -5 }).success, false);
});

test('add: amount cero rechazado', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, amount: 0 }).success, false);
});

test('add: amount NaN (texto no numérico) rechazado', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, amount: 'abc' }).success, false);
});

test('add: fecha imposible 2026-13-99 rechazada (calendario real)', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, date: '2026-13-99' }).success, false);
});

test('add: 2026-02-30 rechazada (febrero no tiene 30)', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, date: '2026-02-30' }).success, false);
});

test('add: 2024-02-29 aceptada (año bisiesto)', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, date: '2024-02-29' }).success, true);
});

test('add: formato no YYYY-MM-DD rechazado', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, date: '15/08/2026' }).success, false);
});

test('add: type inválido rechazado', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, type: 'transfer' }).success, false);
});

test('add: status inválido rechazado', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, status: 'overdue' }).success, false);
});

test('add: descripción vacía rechazada', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, description: '' }).success, false);
});

// ── updateTransactionSchema (REGRESIÓN CRÍTICA) ───────────────────────
test('update: payload vacío NO inyecta recurrence (regresión del default)', () => {
    const r = updateTransactionSchema.parse({});
    assert.equal('recurrence' in r, false, 'el default none NO debe inyectarse en PUT parcial');
});

test('update: solo status conserva el resto ausente', () => {
    const r = updateTransactionSchema.parse({ status: 'completed' });
    assert.deepEqual(Object.keys(r).sort(), ['status']);
});

test('update: recurrence explícita none es válida', () => {
    const r = updateTransactionSchema.parse({ recurrence: 'none' });
    assert.equal(r.recurrence, 'none');
});

test('update: recurrence inválida rechazada', () => {
    assert.equal(updateTransactionSchema.safeParse({ recurrence: 'hourly' }).success, false);
});

test('update: status overdue aceptado (editar una vencida no debe fallar)', () => {
    assert.equal(updateTransactionSchema.safeParse({ status: 'overdue' }).success, true);
});

test('add: status overdue rechazado en creación (solo el sistema lo produce)', () => {
    assert.equal(addTransactionSchema.safeParse({ ...validTx, status: 'overdue' }).success, false);
});

test('update: amount inválido en parcial rechazado', () => {
    assert.equal(updateTransactionSchema.safeParse({ amount: -1 }).success, false);
});

// ── importTransactionsSchema ──────────────────────────────────────────
test('import: csv vacío rechazado', () => {
    assert.equal(importTransactionsSchema.safeParse({ csv: '' }).success, false);
});

test('import: csv > 500KB rechazado', () => {
    assert.equal(importTransactionsSchema.safeParse({ csv: 'x'.repeat(500001) }).success, false);
});

// ── registerSchema ────────────────────────────────────────────────────
test('register: moneda soportada aceptada', () => {
    assert.equal(registerSchema.safeParse({ email: 'a@b.co', password: '123456', currency: 'MXN' }).success, true);
});

test('register: moneda no soportada rechazada', () => {
    assert.equal(registerSchema.safeParse({ email: 'a@b.co', password: '123456', currency: 'XYZ' }).success, false);
});

test('register: currency ausente sigue siendo válido (default EUR en controller)', () => {
    assert.equal(registerSchema.safeParse({ email: 'a@b.co', password: '123456' }).success, true);
});

test('register: email inválido rechazado', () => {
    assert.equal(registerSchema.safeParse({ email: 'no-email', password: '123456' }).success, false);
});

test('register: password < 6 rechazada', () => {
    assert.equal(registerSchema.safeParse({ email: 'a@b.co', password: '12345' }).success, false);
});

// ── loginSchema ───────────────────────────────────────────────────────
test('login: password vacía rechazada', () => {
    assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success, false);
});

// ── saveBudgetsSchema ─────────────────────────────────────────────────
test('budgets: mes 0-11 válido', () => {
    assert.equal(saveBudgetsSchema.safeParse({ month: 0, year: 2026, items: [{ category: 'cat_food', amount: 300 }] }).success, true);
});

test('budgets: mes 12 rechazado', () => {
    assert.equal(saveBudgetsSchema.safeParse({ month: 12, year: 2026, items: [] }).success, false);
});

test('budgets: año 1999 rechazado', () => {
    assert.equal(saveBudgetsSchema.safeParse({ month: 7, year: 1999, items: [] }).success, false);
});

test('budgets: amount negativo rechazado', () => {
    assert.equal(saveBudgetsSchema.safeParse({ month: 7, year: 2026, items: [{ category: 'cat_food', amount: -5 }] }).success, false);
});

test('budgets: amount 0 permitido (se interpreta como sin presupuesto)', () => {
    assert.equal(saveBudgetsSchema.safeParse({ month: 7, year: 2026, items: [{ category: 'cat_food', amount: 0 }] }).success, true);
});

// ── password schemas ──────────────────────────────────────────────────
test('reset: token no-uuid rechazado', () => {
    assert.equal(resetPasswordSchema.safeParse({ token: 'not-a-uuid', password: '123456' }).success, false);
});

test('forgot: email inválido rechazado', () => {
    assert.equal(forgotPasswordSchema.safeParse({ email: 'bad' }).success, false);
});

// ── updateSettingsSchema ──────────────────────────────────────────────
test('settings: language fr rechazado', () => {
    assert.equal(updateSettingsSchema.safeParse({ savings_goal: 100, currency: 'EUR', language: 'fr' }).success, false);
});

test('settings: savings_goal 0 rechazado', () => {
    assert.equal(updateSettingsSchema.safeParse({ savings_goal: 0, currency: 'EUR', language: 'es' }).success, false);
});
