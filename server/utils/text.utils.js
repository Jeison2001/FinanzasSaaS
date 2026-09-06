/**
 * Normaliza texto para búsqueda insensible a acentos/mayúsculas.
 * 'Almacén' → 'almacen'. SQLite LIKE es case-insensitive solo para ASCII
 * y no colapsa acentos, por lo que la comparación se hace sobre esta forma
 * normalizada (columna description_norm).
 */
export const normalizeText = (s) =>
    (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // elimina diacríticos (á→a, ñ→n, ç→c…)
        .toLowerCase();
