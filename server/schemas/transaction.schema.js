import { z } from 'zod';

export const addTransactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Category is required'),
    amount: z.number().positive('Amount must be greater than 0'),
    description: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    status: z.enum(['planned', 'completed']),
    recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional().default('none')
});

export const updateTransactionSchema = addTransactionSchema.partial().extend({
    // Make fields optional for PUT if needed, though typically PUT sends all fields.
    // For safety, we keep them mostly required based on the frontend logic.
});
