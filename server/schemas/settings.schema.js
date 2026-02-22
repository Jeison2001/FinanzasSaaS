import { z } from 'zod';

export const updateSettingsSchema = z.object({
    savings_goal: z.number().positive('Savings goal must be greater than 0'),
    currency: z.string().min(1, 'Currency is required'),
    language: z.enum(['es', 'en', 'ca', 'pt', 'de'])
});
