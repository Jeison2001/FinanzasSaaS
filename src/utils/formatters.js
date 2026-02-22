/**
 * Formatea un valor numérico como moneda según el idioma y código ISO.
 * Fallback a EUR si currency es inválido.
 */
export const formatCurrency = (val, lang, currency) => {
    const safeCurrency = (currency && currency.trim() !== '') ? currency : 'EUR';
    const locale = lang === 'en' ? 'en-US' : (lang === 'ca' ? 'ca-ES' : 'es-ES');
    return val.toLocaleString(locale, { style: 'currency', currency: safeCurrency });
};

/**
 * Formatea una fecha ISO ('YYYY-MM-DD') a formato legible según idioma.
 * Nota: new Date(dateStr) parsea como UTC; solo afecta la presentación visual.
 */
export const formatDateI18n = (dateStr, lang) => {
    const locale = lang === 'en' ? 'en-US' : (lang === 'ca' ? 'ca-ES' : 'es-ES');
    return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: '2-digit' });
};
