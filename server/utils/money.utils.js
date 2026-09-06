/**
 * Utilidades monetarias: el dinero se almacena en céntimos (INTEGER) para
 * aritmética exacta. amount REAL se conserva en la BD por compatibilidad
 * (display/CSV), pero TODO cálculo usa amount_cents.
 */
export const toCents = (amount) => Math.round(Number(amount) * 100);

export const fromCents = (cents) => (Number(cents) || 0) / 100;
