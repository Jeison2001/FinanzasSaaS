/**
 * Matemática de préstamos en céntimos (aritmética exacta, igual filosofía
 * que money.utils.js). Los montos SIEMPRE entran y salen en céntimos
 * (INTEGER); las tasas en porcentaje anual (REAL).
 *
 * Fórmula de cuota francesa (amortización constante de cuota):
 *   cuota = P·i / (1 − (1+i)^(−n))     con i = tasa mensual efectiva
 *
 * Las entradas son validadas aguas arriba (schemas Zod: principal > 0,
 * installments 1–600, annual_rate_pct >= 0, cuota > 0) — aquí solo matemática.
 */

/** Cuota mensual en céntimos para principalCents a annualRatePct % anual en n cuotas. */
export const monthlyPaymentCents = (principalCents, annualRatePct, n) => {
    const i = (annualRatePct / 100) / 12;
    if (i === 0) return Math.round(principalCents / n);
    return Math.round((principalCents * i) / (1 - Math.pow(1 + i, -n)));
};

/**
 * Tasa anual implícita (%) dado principalCents, n cuotas y la cuota mensual
 * en céntimos. Bisección sobre la tasa mensual i: el pago es monótono
 * creciente en i, así que la raíz es única.
 *
 * Si cuota·n <= principal el préstamo ni siquiera cubre el capital
 * (tasa 0 o negativa) → devuelve 0.
 * Devuelve i·12·100 redondeado a 2 decimales.
 */
export const impliedAnnualRatePct = (principalCents, n, monthlyPaymentCents) => {
    if (monthlyPaymentCents * n <= principalCents) return 0;

    // Pago mensual que produciría la tasa mensual i (misma fórmula, sin redondear).
    const paymentAt = (i) => (principalCents * i) / (1 - Math.pow(1 + i, -n));

    // Cota superior: empieza en 100% mensual (1200% anual) y se duplica hasta
    // superar la cuota — cubre casos extremos como n=1 con cuota = k·principal.
    let lo = 0;
    let hi = 1;
    while (paymentAt(hi) < monthlyPaymentCents) {
        hi *= 2;
        if (!Number.isFinite(hi)) return 0; // inmurable → cuota absurda, no crash
    }

    // 200 iteraciones: hi/2^200 excede la precisión de double en todo el rango.
    for (let k = 0; k < 200; k++) {
        const mid = (lo + hi) / 2;
        if (paymentAt(mid) < monthlyPaymentCents) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    const monthlyRate = (lo + hi) / 2;
    return Math.round(monthlyRate * 12 * 100 * 100) / 100;
};
