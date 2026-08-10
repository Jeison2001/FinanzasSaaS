import { z } from 'zod';

export const budgetItemSchema = z.object({
    category: z.string().min(1, 'Categoría es obligatoria'),
    amount: z.coerce.number().nonnegative('El presupuesto no puede ser negativo')
});

export const saveBudgetsSchema = z.object({
    month: z.coerce.number().int().min(0).max(11),
    year: z.coerce.number().int().min(2000).max(2100),
    items: z.array(budgetItemSchema).max(50, 'Demasiados presupuestos en una sola petición')
});
