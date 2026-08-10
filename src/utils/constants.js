/** Meses (0-indexados, como el frontend). */
export const months = Array.from({ length: 12 }, (_, i) => i);

/**
 * Divisas disponibles. Se eligen UNA VEZ en el registro y quedan fijadas
 * para el usuario — no hay conversión, por eso no existe selector global.
 */
export const worldCurrencies = [
    { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' }, { code: 'JPY', name: 'Japanese Yen' },
    { code: 'MXN', name: 'Peso Mexicano' }, { code: 'ARS', name: 'Peso Argentino' },
    { code: 'COP', name: 'Peso Colombiano' }, { code: 'CLP', name: 'Peso Chileno' },
    { code: 'BRL', name: 'Real Brasileiro' }, { code: 'PEN', name: 'Sol Peruano' },
];

/**
 * Años disponibles para filtros, derivados del año actual para no quedar
 * obsoletos (año anterior, actual y siguiente).
 */
const currentYear = new Date().getFullYear();
export const years = [currentYear - 1, currentYear, currentYear + 1];

/** Períodos disponibles en los KPIs. */
export const statPeriods = ['month', 'year', 'all'];

/** Estados de transacción. */
export const txStatuses = ['completed', 'planned', 'overdue'];

/**
 * Claves de categoría por tipo de transacción.
 * Se traducen en tiempo real con useTranslation — no almacenar el texto, solo la clave.
 */
export const categories = {
    income: ['cat_salary', 'cat_freelance', 'cat_investment', 'cat_sales', 'cat_others'],
    expense: ['cat_housing', 'cat_food', 'cat_transport', 'cat_leisure', 'cat_health', 'cat_subs', 'cat_savings', 'cat_others']
};
