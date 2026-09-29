/**
 * Tests unitarios — loan.utils.js (matemática de préstamos en céntimos).
 * Ejecutar: npm run test:unit
 *
 * Valor de referencia EXTERNO (calculadora de préstamos estándar, fórmula
 * francesa — no derivado de esta implementación): 10000 unidades al 12%
 * anual en 12 meses → cuota 888.49 = 88849 céntimos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyPaymentCents, impliedAnnualRatePct } from '../utils/loan.utils.js';

// ── monthlyPaymentCents ──────────────────────────────────────────────
test('referencia externa: 10000 unidades al 12% anual en 12 meses = 88849 céntimos', () => {
    // 10,000.00 → 1,000,000 céntimos; cualquier calculadora de cuotas da 888.49
    assert.equal(monthlyPaymentCents(1_000_000, 12, 12), 88849);
});

test('tasa 0: cuota = principal/n exacto', () => {
    assert.equal(monthlyPaymentCents(120_000, 0, 12), 10_000);
});

test('tasa 0: redondeo al céntimo cuando no divide exacto', () => {
    assert.equal(monthlyPaymentCents(100_000, 0, 3), 33_333);
});

test('1 sola cuota: cuota = principal·(1+i) (50500 para 50000 al 12%)', () => {
    assert.equal(monthlyPaymentCents(50_000, 12, 1), 50_500);
});

// ── impliedAnnualRatePct: casos límite ───────────────────────────────
test('tasa 0 exacta: cuota·n igual al capital → 0', () => {
    assert.equal(impliedAnnualRatePct(120_000, 12, 10_000), 0);
});

test('cuota insuficiente: cuota·n menor al capital → 0', () => {
    // 80,000 × 12 = 960,000 < 1,000,000 — ni cubre el capital
    assert.equal(impliedAnnualRatePct(1_000_000, 12, 80_000), 0);
});

test('1 cuota: ida y vuelta exacta (50500 → 12% anual)', () => {
    assert.equal(impliedAnnualRatePct(50_000, 1, 50_500), 12);
});

test('cuota extrema n=1: cuota = 3·capital → tasa implícita 2400% anual', () => {
    // capital·(1+i) = 3·capital → i = 2 mensual → 2·12·100 = 2400
    assert.equal(impliedAnnualRatePct(10_000, 1, 30_000), 2400);
});

// ── impliedAnnualRatePct: ida y vuelta tasa → cuota → tasa ───────────
test('ida y vuelta: 12% anual, referencia 88849 → tasa implícita 12%', () => {
    assert.equal(impliedAnnualRatePct(1_000_000, 12, 88849), 12);
});

test('ida y vuelta: 7.5% anual, 24 cuotas, 5000 unidades', () => {
    const cuota = monthlyPaymentCents(500_000, 7.5, 24);
    assert.equal(impliedAnnualRatePct(500_000, 24, cuota), 7.5);
});

test('ida y vuelta: 5.25% anual, 36 cuotas, 10000 unidades', () => {
    const cuota = monthlyPaymentCents(1_000_000, 5.25, 36);
    assert.equal(impliedAnnualRatePct(1_000_000, 36, cuota), 5.25);
});
