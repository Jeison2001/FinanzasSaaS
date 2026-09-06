import { z } from 'zod';

export const updateSettingsSchema = z.object({
    savings_goal: z.number().positive('Savings goal must be greater than 0'),
    currency: z.string().min(1, 'Currency is required'),
    language: z.enum(['es', 'en', 'ca']),
    // Zona horaria IANA del dispositivo ('America/Bogota'). Opcional: el
    // UPSERT con COALESCE conserva la existente si el cliente no la envía.
    timezone: z.string().max(64).regex(/^[\w+\-/]+$/, 'Timezone inválida').optional()
});
