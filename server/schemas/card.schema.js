import { z } from 'zod';

/**
 * Contratos Zod de tarjetas de crédito. limit_amount entra en unidades de
 * moneda (se guarda como limit_cents); cut_day 1-31 y min_payment_pct 0-100
 * son parámetros de la entidad (el 'usado' se DERIVA de transactions).
 */

export const addCardSchema = z.object({
    name: z.string().min(1, 'Card name is required'),
    limit_amount: z.coerce.number().positive('Limit must be greater than 0'),
    cut_day: z.coerce.number().int('Cut day must be an integer').min(1, 'Cut day must be between 1 and 31').max(31, 'Cut day must be between 1 and 31').default(1),
    min_payment_pct: z.coerce.number().min(0, 'Min payment pct must be between 0 and 100').max(100, 'Min payment pct must be between 0 and 100').default(5)
});

/**
 * Update parcial: campos explícitos SIN defaults (nunca .partial() sobre
 * schemas con .default() — el default se inyectaría en el PUT parcial).
 */
export const updateCardSchema = z.object({
    name: z.string().min(1, 'Card name is required').optional(),
    limit_amount: z.coerce.number().positive('Limit must be greater than 0').optional(),
    cut_day: z.coerce.number().int('Cut day must be an integer').min(1, 'Cut day must be between 1 and 31').max(31, 'Cut day must be between 1 and 31').optional(),
    min_payment_pct: z.coerce.number().min(0, 'Min payment pct must be between 0 and 100').max(100, 'Min payment pct must be between 0 and 100').optional()
});
