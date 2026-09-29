/**
 * E2E — feature Entidades: cuentas, tarjetas y su integración con los
 * movimientos. Flujo serial del contrato: registro → crear cuenta → ingreso
 * → saldo en panel → crear tarjeta → compra con tarjeta → uso en panel.
 *
 * Usuario de prueba PROPIO (independiente del de app.spec.js), auto-limpiado
 * en afterAll: incluye las tablas nuevas de la feature (accounts,
 * credit_cards, loans) además de las del resto de la app.
 */
import { test, expect, chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EMAIL = `e2e_ent_${Date.now()}@finanzassaa.dev`;
const API = 'http://localhost:3997/api';
const ACCOUNT_NAME = 'Cuenta E2E Entidades';
const CARD_NAME = 'Visa E2E Entidades';

test.describe.serial('Feature Entidades: cuenta → ingreso → saldo → tarjeta → compra → uso', () => {
    let page;
    // Navegador PROPIO de este spec: app.spec.js cierra el `browser` compartido
    // en su afterAll y con workers:1 el worker se reutiliza entre archivos, así
    // que el fixture llega CERRADO a este archivo ("Target page, context or
    // browser has been closed" en beforeAll). Lanzamos el nuestro replicando el
    // canal/viewport/locale de playwright.config.js sin tocarlo.
    let browser;

    test.beforeAll(async () => {
        browser = await chromium.launch({ channel: 'msedge' });
        const ctx = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            locale: 'es-ES',
        });
        page = await ctx.newPage();
    });

    test.afterAll(async () => {
        if (browser) await browser.close();
    });

    test('registro con moneda EUR → dashboard visible', async () => {
        await page.goto('/');
        await page.getByText('¿No tienes cuenta? Regístrate').click();

        // Los labels no tienen htmlFor — selectores directos por tipo de input
        await page.locator('input[type="email"]').fill(EMAIL);
        await page.locator('input[type="password"]').fill('e2epass123');

        // Moneda explícita (EUR): el formato esperado en el panel es es-ES/EUR
        const currencySelect = page.locator('select').filter({ hasText: 'EUR — Euro' });
        await expect(currencySelect).toBeVisible();
        await currencySelect.selectOption('EUR');

        await page.getByRole('button', { name: 'Crear Cuenta' }).click();

        // Login automático → header del dashboard
        await expect(page.getByText('Nueva Transacción')).toBeVisible();
    });

    test('crear cuenta → fila en el panel con su saldo inicial', async () => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Entidades' }).click();

        await page.getByRole('button', { name: 'Nueva Cuenta' }).click();
        const form = page.locator('form').filter({ hasText: 'Saldo inicial' });
        await form.locator('input[type="text"]').fill(ACCOUNT_NAME);
        await form.locator('input[type="number"]').fill('1000');
        await form.getByRole('button', { name: 'Guardar' }).click();

        // La fila aparece en el panel: nombre + saldo inicial.
        // OJO: es-ES moderno NO agrupa 4 dígitos (minimumGroupingDigits=2 de
        // CLDR): 1000 se pinta "1000,00 €", NO "1.000,00 €".
        await expect(page.getByText(ACCOUNT_NAME)).toBeVisible();
        await expect(page.getByText('1000,00').first()).toBeVisible();
    });

    test('ingreso a la cuenta desde el modal del header (cuenta obligatoria con cuentas existentes)', async () => {
        await page.getByText('Nueva Transacción').click();

        const modal = page.locator('div.fixed.inset-0');
        await modal.getByRole('button', { name: 'Ingresos' }).click();

        // Contrato: con cuentas existentes el select de cuenta es required
        const accountSelect = modal.locator('select').filter({ has: page.locator('option', { hasText: ACCOUNT_NAME }) });
        await expect(accountSelect).toBeVisible();
        await expect(accountSelect).toHaveAttribute('required', '');
        await accountSelect.selectOption({ label: ACCOUNT_NAME });

        await modal.locator('input[type="text"]').first().fill('E2E Nómina entidades');
        await modal.locator('input[type="number"]').first().fill('250');
        await modal.getByRole('button', { name: 'Guardar' }).click();

        await expect(modal).toHaveCount(0);
    });

    test('saldo de la cuenta en el panel refleja el ingreso sin remontar el tab', async () => {
        // Seguimos en el tab entidades: 1000 (inicial) + 250 (ingreso) = "1250,00 €"
        // (es-ES moderno no agrupa 4 dígitos). La fila de cuenta sale de las
        // listas de entidades — este aserto cubre que la mutación de movimientos
        // refresca el panel abierto (no solo el resumen del overview). Scoping a
        // la FILA: el resumen del overview no puede enmascarar una lista de
        // entidades sin recargar.
        const accRow = page.locator('div.bg-slate-50.rounded-2xl', { hasText: ACCOUNT_NAME });
        await expect(accRow.getByText(/1250,00/)).toBeVisible();

        // La verdad importa: el saldo lo deriva el server por agregación SQL
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const res = await fetch(`${API}/overview`, { headers: { Authorization: `Bearer ${token}` } });
        const overview = await res.json();
        expect(overview.accounts[0].balance).toBe(1250);
        expect(overview.accountsTotal).toBe(1250);
        expect(overview.netWorth).toBeCloseTo(1250, 2); // aún sin tarjetas ni préstamos
    });

    test('crear tarjeta → fila en el panel', async () => {
        await page.getByRole('button', { name: 'Nueva Tarjeta' }).click();
        const form = page.locator('form').filter({ hasText: 'Cupo total' });
        await form.locator('input[type="text"]').fill(CARD_NAME);
        await form.locator('input[type="number"]').nth(0).fill('500');   // cupo total
        await form.locator('input[type="number"]').nth(1).fill('5');     // día de corte
        await form.locator('input[type="number"]').nth(2).fill('10');    // % pago mínimo
        await form.getByRole('button', { name: 'Guardar' }).click();

        await expect(page.getByText(CARD_NAME)).toBeVisible();
    });

    test('compra con tarjeta desde el modal (tarjeta obligatoria)', async () => {
        await page.getByText('Nueva Transacción').click();

        const modal = page.locator('div.fixed.inset-0');
        await modal.getByRole('button', { name: 'Compra con tarjeta' }).click();

        const cardSelect = modal.locator('select').filter({ has: page.locator('option', { hasText: CARD_NAME }) });
        await expect(cardSelect).toBeVisible();
        await cardSelect.selectOption({ label: CARD_NAME });

        await modal.locator('input[type="text"]').first().fill('E2E Compra tarjeta');
        await modal.locator('input[type="number"]').first().fill('80.5');
        await modal.getByRole('button', { name: 'Guardar' }).click();

        await expect(modal).toHaveCount(0);
    });

    test('uso de la tarjeta en el panel: usado 80,50 € y 16% del cupo', async () => {
        // La compra NO toca el saldo de la cuenta (card_purchase sin cuenta):
        // '80,50' sale del usado de tarjeta (fila + resumen), no del saldo.
        const cardRow = page.locator('div.bg-slate-50.rounded-2xl', { hasText: CARD_NAME });
        await expect(cardRow.getByText(/80,50/)).toBeVisible();   // Usado: 80,50 € / 500,00 €
        // Barra de uso: 80,50 / 500,00 → 16% (semáforo verde, < 80% del cupo)
        await expect(cardRow.getByText('16%')).toBeVisible();

        // Resumen: Tarjetas en negativo y Patrimonio Neto = 1250,00 − 80,50
        await expect(page.getByText(/−80,50/)).toBeVisible();
        await expect(page.getByText(/1169,50/)).toBeVisible();

        // La verdad importa: usado/pago mínimo derivados por agregación SQL
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const res = await fetch(`${API}/overview`, { headers: { Authorization: `Bearer ${token}` } });
        const overview = await res.json();
        expect(overview.accountsTotal).toBe(1250); // la compra no toca el saldo de cuentas
        expect(overview.cardsUsed).toBeCloseTo(80.5, 2);
        expect(overview.netWorth).toBeCloseTo(1169.5, 2);
        expect(overview.cards[0].used).toBeCloseTo(80.5, 2);
        expect(overview.cards[0].minPayment).toBeCloseTo(8.05, 2); // 10% de 80,50
    });

    test.afterAll(async () => {
        // Limpieza del usuario E2E y SUS datos (BD real de Turso), incluidas
        // las entidades de la feature.
        const { default: db } = await import(join(ROOT, 'server', 'db.js'));
        const u = await db.execute('SELECT id FROM users WHERE email = ?', [EMAIL]);
        if (u.rows.length > 0) {
            const id = u.rows[0].id;
            await db.execute('DELETE FROM transactions WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM accounts WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM credit_cards WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM loans WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM budgets WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM user_notifications WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM user_settings WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM users WHERE id = ?', [id]);
            console.log(`\n🧹 usuario E2E de entidades limpiado: ${EMAIL}`);
        }
    });
});
