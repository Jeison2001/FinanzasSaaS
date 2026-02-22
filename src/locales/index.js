import { translationsEs } from './es';
import { translationsEn } from './en';
import { translationsCa } from './ca';

const translations = { es: translationsEs, en: translationsEn, ca: translationsCa };

/**
 * Hook de traducción. Devuelve una función t(key) que retorna
 * el texto en el idioma activo, o la propia key si no existe traducción.
 */
export const useTranslation = (lang) => {
    return (key) => translations[lang]?.[key] || key;
};
