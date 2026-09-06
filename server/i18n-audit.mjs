/**
 * Auditoría i18n en ambas direcciones:
 * 1) keys USADAS en el código (t('key')) que NO están definidas → bug visible
 * 2) keys DEFINIDAS que nadie usa → basura
 * 3) paridad entre los 3 idiomas
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const LOCALES = join(SRC, 'locales');

// ── Cargar definiciones ──
const defined = {};
for (const f of ['es.js', 'en.js', 'ca.js']) {
    const mod = await import(`file://${join(LOCALES, f).replace(/\\/g, '/')}`);
    defined[f] = Object.keys(Object.values(mod)[0]);
}

// ── Recolectar keys usadas: t('x'), t("x") en todo src/ ──
const used = new Set();
const scan = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) { scan(p); continue; }
        if (!/\.(jsx|js)$/.test(f.name)) continue;
        const content = readFileSync(p, 'utf8');
        for (const m of content.matchAll(/\bt\(\s*['"`]([\w.]+)['"`]\s*\)/g)) used.add(m[1]);
    }
};
scan(SRC);

let problems = 0;

// 1) Usadas sin definir (en cualquiera de los idiomas)
for (const key of used) {
    for (const [f, keys] of Object.entries(defined)) {
        if (!keys.includes(key)) {
            console.log(`❌ USADA sin definir: "${key}" falta en ${f}`);
            problems++;
        }
    }
}

// 2) Definidas sin usar (basura). Excepción: keys usadas DINÁMICAMENTE
//    (t(variable)) — prefijos con llamada dinámica confirmada en el código.
//    Para cat_* se verifica además que la key exista en constants.js.
const DYNAMIC_PREFIXES = ['cat_', 'notif_', 'period'];
const constantsSrc = readFileSync(join(SRC, 'utils', 'constants.js'), 'utf8');
const definedEs = new Set(defined['es.js']);
for (const key of definedEs) {
    if (used.has(key)) continue;
    if (DYNAMIC_PREFIXES.some(p => key.startsWith(p))) {
        if (key.startsWith('cat_') && !constantsSrc.includes(`'${key}'`)) {
            console.log(`🗑️  cat_ DEFINIDA sin uso ni presencia en constants.js: "${key}"`);
            problems++;
        }
        continue; // usada dinámicamente (t(item.category), t(notif.message_key), t(opt.key))
    }
    console.log(`🗑️  DEFINIDA sin usar: "${key}"`);
    problems++;
}

// 3) Paridad entre idiomas
const [es, en, ca] = [defined['es.js'], defined['en.js'], defined['ca.js']];
for (const [name, a, b] of [['en', es, en], ['ca', es, ca]]) {
    const missingInB = a.filter(k => !b.includes(k));
    const extraInB = b.filter(k => !a.includes(k));
    if (missingInB.length || extraInB.length) {
        console.log(`❌ Paridad es↔${name}: faltan ${JSON.stringify(missingInB)}, sobran ${JSON.stringify(extraInB)}`);
        problems++;
    }
}

console.log(`\nResumen: ${used.size} keys usadas, ${es.length} definidas en es, ${problems} problema(s).`);
process.exit(problems > 0 ? 1 : 0);
