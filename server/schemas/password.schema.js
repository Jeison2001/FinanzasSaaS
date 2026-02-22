import { z } from 'zod';

export const forgotPasswordSchema = z.object({
    email: z.string().email('Email inválido')
});

export const resetPasswordSchema = z.object({
    token: z.string().uuid('Token inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});
