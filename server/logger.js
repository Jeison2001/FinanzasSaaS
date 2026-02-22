/**
 * Logger centralizado usando Pino.
 * - En desarrollo: salida legible por terminal (pino-pretty).
 * - En producción: JSON estructurado, listo para ingestión por cualquier agregador de logs.
 * Niveles disponibles: trace | debug | info | warn | error | fatal
 */
import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL;

if (!LOG_LEVEL) {
    console.error('FATAL ERROR: LOG_LEVEL no está definido en .env');
    process.exit(1);
}

const logger = pino({
    level: LOG_LEVEL,
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined // En producción: JSON puro por stdout
});

export default logger;
