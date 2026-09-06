/**
 * Tests unitarios — money.utils.js y todayInTimeZone.
 * Ejecutar: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, fromCents } from '../utils/money.utils.js';
import { todayInTimeZone } from '../utils/date.utils.js';

// ── money.utils: céntimos exactos ─────────────────────────────────────
test('toCents: valores con decimales problemáticos', () => {
    assert.equal(toCents(0.1), 10);
    assert.equal(toCents(0.2), 20);
    assert.equal(toCents(19.99), 1999);
    assert.equal(toCents(45.5), 4550);
    assert.equal(toCents(0.3), 30);
});

test('toCents: strings numéricas del import CSV', () => {
    assert.equal(toCents('45.5'), 4550);
    assert.equal(toCents('19.99'), 1999);
    assert.equal(toCents('0.07'), 7);
});

test('toCents: enteros y cero', () => {
    assert.equal(toCents(2000), 200000);
    assert.equal(toCents(0), 0);
});

test('toCents: el artefacto float 0.30000000000000004 se corrige', () => {
    // Simula una suma float entrante (p.ej. desde un cálculo previo)
    assert.equal(toCents(0.1 + 0.2), 30);
});

test('fromCents: ida y vuelta exacta', () => {
    for (const v of [0.01, 0.1, 19.99, 45.5, 1234.56, 2000]) {
        assert.equal(fromCents(toCents(v)), v);
    }
});

test('fromCents: null/undefined → 0', () => {
    assert.equal(fromCents(null), 0);
    assert.equal(fromCents(undefined), 0);
});

// ── todayInTimeZone ───────────────────────────────────────────────────
test('timezone válida devuelve YYYY-MM-DD de esa zona', () => {
    const bogota = todayInTimeZone('America/Bogota');
    assert.match(bogota, /^\d{4}-\d{2}-\d{2}$/);
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    assert.equal(bogota, expected);
});

test('timezone con desfase de un día respecto al server se refleja', () => {
    // Compara dos zonas opuestas: si en el server es madrugada del día X,
    // en el Pacífico puede ser aún el día anterior.
    const a = todayInTimeZone('Pacific/Kiritimati'); // UTC+14
    const b = todayInTimeZone('Pacific/Midway');     // UTC-11
    const nowUtcHour = new Date().getUTCHours();
    // Solo hay diferencia cuando el server está entre 10:00 y 23:59 UTC
    if (nowUtcHour >= 10) {
        assert.notEqual(a, b, 'zonas con 25h de diferencia no deben dar la misma fecha');
    }
});

test('timezone inválida cae al hoy local del server sin lanzar', () => {
    assert.equal(todayInTimeZone('Marte/Olympus'), todayInTimeZone(undefined));
    assert.match(todayInTimeZone('Marte/Olympus'), /^\d{4}-\d{2}-\d{2}$/);
});

test('timezone null/undefined usa la local del server', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.equal(todayInTimeZone(null), expected);
});
