/**
 * Tests unitarios — text.utils.js (normalización para búsqueda sin acentos).
 * Ejecutar: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText } from '../utils/text.utils.js';

test('minúsculas y sin acentos', () => {
    assert.equal(normalizeText('Almacén'), 'almacen');
});

test('mayúsculas con acento', () => {
    assert.equal(normalizeText('ÁLGODÓN'), 'algodon');
});

test('catalán: ç, ò, ·', () => {
    assert.equal(normalizeText('Caçadora'), 'cacadora');
    assert.equal(normalizeText('Pèsol'), 'pesol');
});

test('eñe', () => {
    assert.equal(normalizeText('Año Nuevo'), 'ano nuevo');
});

test('diéresis', () => {
    assert.equal(normalizeText('Cigüeña'), 'ciguena');
});

test('string vacío, null y undefined no lanzan', () => {
    assert.equal(normalizeText(''), '');
    assert.equal(normalizeText(null), '');
    assert.equal(normalizeText(undefined), '');
});

test('números y símbolos se preservan', () => {
    assert.equal(normalizeText('Cena "especial" 50%'), 'cena "especial" 50%');
});

test('comportamiento simétrico con la columna description_norm', () => {
    // Réplica EXACTA del backfill SQL (acentos mayúsculos → minúscula, luego
    // minúsculos, luego LOWER): lo que guarda la BD debe equivaler a lo que
    // la query normaliza en JS, o el LIKE no encontraría nada.
    const sqlStyle = (s) => String(s)
        .replaceAll('Á', 'a').replaceAll('É', 'e').replaceAll('Í', 'i')
        .replaceAll('Ó', 'o').replaceAll('Ú', 'u').replaceAll('Ü', 'u')
        .replaceAll('Ñ', 'n').replaceAll('Ç', 'c').replaceAll('À', 'a')
        .replaceAll('È', 'e').replaceAll('Ì', 'i').replaceAll('Ò', 'o')
        .replaceAll('Ù', 'u')
        .replaceAll('á', 'a').replaceAll('é', 'e').replaceAll('í', 'i')
        .replaceAll('ó', 'o').replaceAll('ú', 'u').replaceAll('ü', 'u')
        .replaceAll('ñ', 'n').replaceAll('ç', 'c')
        .toLowerCase();
    for (const sample of ['Almacén Central', 'Cigüeña', 'Coraçao', 'ÑANDÚ', 'Pagó Ibérica', 'ÁLGODÓN']) {
        assert.equal(normalizeText(sample), sqlStyle(sample), `mismatch en "${sample}"`);
    }
});
