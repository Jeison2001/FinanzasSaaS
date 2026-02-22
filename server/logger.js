/**
 * Logger centralizado usando Pino.
 * - En desarrollo: salida legible por terminal (pino-pretty).
 * - En producción: JSON estructurado, listo para ingestión por cualquier agregador de logs.
 * Niveles disponibles: trace | debug | info | warn | error | fatal
 */
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined // En producción: JSON puro por stdout
});

export default logger;
