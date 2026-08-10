import { z } from 'zod';

/** Divisas soportadas (coinciden con worldCurrencies del frontend). */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'MXN', 'ARS', 'COP', 'CLP', 'BRL', 'PEN'];

export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    role: z.enum(['admin', 'client']).optional(),
    currency: z.enum(SUPPORTED_CURRENCIES).optional()
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
});
