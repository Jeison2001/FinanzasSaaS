import { z } from 'zod';

/** Solo zonas IANA reales que el runtime reconoce ('America/Bogota' ✓, 'Marte/Olympus' ✗). */
const ianaTimezone = z.string().max(64).refine(
    (tz) => {
        try {
            new Intl.DateTimeFormat('en-CA', { timeZone: tz });
            return true;
        } catch {
            return false;
        }
    },
    'Timezone inválida'
);

export const updateSettingsSchema = z.object({
    savings_goal: z.number().positive('Savings goal must be greater than 0'),
    currency: z.string().min(1, 'Currency is required'),
    language: z.enum(['es', 'en', 'ca']),
    // Zona horaria IANA del dispositivo. Opcional: el UPSERT con COALESCE
    // conserva la existente si el cliente no la envía.
    timezone: ianaTimezone.optional()
});
