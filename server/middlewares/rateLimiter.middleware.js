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

/**
 * Limiter laxo para endpoints costosos (parse CSV).
 * 30 importaciones por minuto por IP.
 */
export const importLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Demasiadas importaciones seguidas. Espera un minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
});
