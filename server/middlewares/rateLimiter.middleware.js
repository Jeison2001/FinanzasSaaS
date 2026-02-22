import rateLimit from 'express-rate-limit';

/**
 * Rate limiter para rutas de autenticación sensibles.
 * Máximo 15 intentos por IP en una ventana de 15 minutos.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' },
    standardHeaders: true,
    legacyHeaders: false,
});
