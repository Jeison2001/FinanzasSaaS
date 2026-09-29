import { z } from 'zod';

/**
 * Contratos Zod de cuentas. El monto entra en unidades de moneda
 * (initial_amount >= 0) y el controller lo convierte a céntimos
 * (initial_cents) con toCents — el dinero físico vive en céntimos.
 */

export const addAccountSchema = z.object({
    name: z.string().min(1, 'Account name is required'),
    initial_amount: z.coerce.number().min(0, 'Initial amount must be zero or greater')
});

/**
 * Update parcial: campos explícitos SIN defaults (nunca .partial() sobre
 * schemas con .default() — el default se inyectaría en el PUT parcial).
 */
export const updateAccountSchema = z.object({
    name: z.string().min(1, 'Account name is required').optional(),
    initial_amount: z.coerce.number().min(0, 'Initial amount must be zero or greater').optional()
});
