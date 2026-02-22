/** Divisas disponibles en el selector de configuración. */
export const worldCurrencies = [
    { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' }, { code: 'JPY', name: 'Japanese Yen' },
    { code: 'MXN', name: 'Peso Mexicano' }, { code: 'ARS', name: 'Peso Argentino' },
    { code: 'COP', name: 'Peso Colombiano' }, { code: 'CLP', name: 'Peso Chileno' },
    { code: 'BRL', name: 'Real Brasileiro' }, { code: 'PEN', name: 'Sol Peruano' },
];

export const months = Array.from({ length: 12 }, (_, i) => i);
export const years = [2024, 2025, 2026];

/**
 * Claves de categoría por tipo de transacción.
 * Se traducen en tiempo real con useTranslation — no almacenar el texto, solo la clave.
 */
export const categories = {
    income: ['cat_salary', 'cat_freelance', 'cat_investment', 'cat_sales', 'cat_others'],
    expense: ['cat_housing', 'cat_food', 'cat_transport', 'cat_leisure', 'cat_health', 'cat_subs', 'cat_savings', 'cat_others']
};
