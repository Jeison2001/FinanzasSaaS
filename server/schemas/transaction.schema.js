import { z } from 'zod';

/** Fecha YYYY-MM-DD con rango real validado (rechaza 2026-13-99). */
const dateLike = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(d => {
        const [y, m, dd] = d.split('-').map(Number);
        const dt = new Date(y, m - 1, dd);
        return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === dd;
    }, 'Date must be a real calendar date');

export const addTransactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Category is required'),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    description: z.string().min(1, 'Description is required'),
    date: dateLike,
    status: z.enum(['planned', 'completed']),
    recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).default('none')
});

/**
 * Schema de actualización: campos opcionales SIN defaults.
 * Importante: `.partial()` sobre addTransactionSchema conservaría el
 * `.default('none')` de Zod en recurrence, inyectándolo en el body cuando
 * el campo falta y matando la recurrencia en actualizaciones parciales.
 * Por eso se definen los campos explícitamente sin default.
 */
export const updateTransactionSchema = z.object({
    type: z.enum(['income', 'expense']).optional(),
    category: z.string().min(1, 'Category is required').optional(),
    amount: z.coerce.number().positive('Amount must be greater than 0').optional(),
    description: z.string().min(1, 'Description is required').optional(),
    date: dateLike.optional(),
    status: z.enum(['planned', 'completed']).optional(),
    recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional()
});

export const importTransactionsSchema = z.object({
    csv: z.string().min(1, 'CSV es obligatorio').max(500000, 'CSV demasiado grande')
});
