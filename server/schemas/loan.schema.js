import { z } from 'zod';

/**
 * Contratos Zod de préstamos. El préstamo se define O por tasa anual
 * (annual_rate_pct >= 0, el controller calcula la cuota) O por cuota
 * mensual (monthly_payment_amount > 0, el controller calcula la tasa
 * implícita con loan.utils) — nunca ambas: XOR en el refine.
 * El rechazo de "cuota×n < principal" lo hace el controller (necesita
 * céntimos exactos), no el schema.
 */

const exactlyOneRateOrPayment = (l) => (l.annual_rate_pct !== undefined) !== (l.monthly_payment_amount !== undefined);

export const addLoanSchema = z.object({
    name: z.string().min(1, 'Loan name is required'),
    principal_amount: z.coerce.number().positive('Principal must be greater than 0'),
    installments: z.coerce.number().int('Installments must be an integer').min(1, 'Installments must be between 1 and 600').max(600, 'Installments must be between 1 and 600'),
    annual_rate_pct: z.coerce.number().min(0, 'Annual rate must be zero or greater').optional(),
    monthly_payment_amount: z.coerce.number().positive('Monthly payment must be greater than 0').optional()
}).refine(exactlyOneRateOrPayment, {
    message: 'Provide exactly one of annual_rate_pct or monthly_payment_amount'
});

/**
 * Update parcial: campos explícitos SIN defaults. Si el payload trae tasa O
 * cuota (una sola), el controller recalcula la otra; si no trae ninguna,
 * conserva las existentes. Por eso el refine aquí acepta "ninguna" también.
 */
export const updateLoanSchema = z.object({
    name: z.string().min(1, 'Loan name is required').optional(),
    principal_amount: z.coerce.number().positive('Principal must be greater than 0').optional(),
    installments: z.coerce.number().int('Installments must be an integer').min(1, 'Installments must be between 1 and 600').max(600, 'Installments must be between 1 and 600').optional(),
    annual_rate_pct: z.coerce.number().min(0, 'Annual rate must be zero or greater').optional(),
    monthly_payment_amount: z.coerce.number().positive('Monthly payment must be greater than 0').optional()
}).refine((l) => {
    const hasRate = l.annual_rate_pct !== undefined;
    const hasPayment = l.monthly_payment_amount !== undefined;
    return hasRate !== hasPayment || (!hasRate && !hasPayment);
}, {
    message: 'Provide exactly one of annual_rate_pct or monthly_payment_amount'
});
