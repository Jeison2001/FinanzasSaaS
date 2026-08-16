/**
 * Tests unitarios — date.utils.js (aritmética de recurrencia).
 * Ejecutar: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNextDate, fmtLocalDate, localToday } from '../utils/date.utils.js';

// ── DAILY ────────────────────────────────────────────────────────────
test('daily: día siguiente simple', () => {
    assert.equal(getNextDate('2026-08-15', 'daily'), '2026-08-16');
});

test('daily: cruce de mes (31 ene → 1 feb)', () => {
    assert.equal(getNextDate('2026-01-31', 'daily'), '2026-02-01');
});

test('daily: cruce de año (31 dic → 1 ene)', () => {
    assert.equal(getNextDate('2026-12-31', 'daily'), '2027-01-01');
});

// ── WEEKLY ───────────────────────────────────────────────────────────
test('weekly: +7 días simple', () => {
    assert.equal(getNextDate('2026-08-15', 'weekly'), '2026-08-22');
});

test('weekly: cruce de mes (28 feb 2026 → 7 mar)', () => {
    // 2026 no es bisiesto: febrero tiene 28 días
    assert.equal(getNextDate('2026-02-28', 'weekly'), '2026-03-07');
});

test('weekly: febrero bisiesto (28 feb 2024 → 6 mar)', () => {
    assert.equal(getNextDate('2024-02-28', 'weekly'), '2024-03-06');
});

// ── MONTHLY ──────────────────────────────────────────────────────────
test('monthly: mes siguiente simple', () => {
    assert.equal(getNextDate('2026-08-15', 'monthly'), '2026-09-15');
});

test('monthly: clamp 31 ene → 28 feb (mes corto)', () => {
    assert.equal(getNextDate('2026-01-31', 'monthly'), '2026-02-28');
});

test('monthly: clamp 30 ene → 28 feb', () => {
    assert.equal(getNextDate('2026-01-30', 'monthly'), '2026-02-28');
});

test('monthly: clamp 31 mar → 30 abr', () => {
    assert.equal(getNextDate('2026-03-31', 'monthly'), '2026-04-30');
});

test('monthly: clamp en bisiesto 29 ene 2024 → 29 feb 2024', () => {
    assert.equal(getNextDate('2024-01-29', 'monthly'), '2024-02-29');
});

test('monthly: cruce de año (15 dic → 15 ene siguiente)', () => {
    assert.equal(getNextDate('2026-12-15', 'monthly'), '2027-01-15');
});

test('monthly: clamp cruce de año (31 dic → 31 ene)', () => {
    assert.equal(getNextDate('2026-12-31', 'monthly'), '2027-01-31');
});

// ── YEARLY ───────────────────────────────────────────────────────────
test('yearly: año siguiente simple', () => {
    assert.equal(getNextDate('2026-05-10', 'yearly'), '2027-05-10');
});

test('yearly: 29 feb bisiesto → 28 feb no bisiesto', () => {
    assert.equal(getNextDate('2024-02-29', 'yearly'), '2025-02-28');
});

// ── Recurrencia desconocida / robustez ────────────────────────────────
test('recurrencia desconocida devuelve la misma fecha', () => {
    assert.equal(getNextDate('2026-08-15', 'fortnightly'), '2026-08-15');
});

test('recurrencia undefined no lanza', () => {
    assert.equal(getNextDate('2026-08-15', undefined), '2026-08-15');
});

// ── Formatters ────────────────────────────────────────────────────────
test('fmtLocalDate: padding de mes y día', () => {
    assert.equal(fmtLocalDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('fmtLocalDate: fecha de dos dígitos sin alterar', () => {
    assert.equal(fmtLocalDate(new Date(2026, 11, 25)), '2026-12-25');
});

test('localToday: formato YYYY-MM-DD válido', () => {
    assert.match(localToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('localToday: coincide con la fecha local del sistema', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.equal(localToday(), expected);
});
