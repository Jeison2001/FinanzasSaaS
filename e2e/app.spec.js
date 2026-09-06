/**
 * E2E — flujos críticos de usuario en navegador real (Edge).
 * Cubre lo que la suite de integración no puede: la UI renderizada,
 * clicks reales y feedback visible (toasts, badges, tablas).
 * Usuario de prueba único por corrida, auto-limpiado en afterAll.
 */
import { test, expect } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EMAIL = `e2e_${Date.now()}@finanzassaa.dev`;
const API = 'http://localhost:3997/api';

test.describe.serial('Flujo de usuario completo', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext();
        page = await ctx.newPage();
    });

    test.afterAll(async ({ browser }) => {
        await browser.close();
    });

    test('registro con selector de moneda → dashboard visible', async () => {
        await page.goto('/');
        await page.getByText('¿No tienes cuenta? Regístrate').click();

        // Los labels no tienen htmlFor — selectores directos por tipo de input
        await page.locator('input[type="email"]').fill(EMAIL);
        await page.locator('input[type="password"]').fill('e2epass123');

        // Selector de moneda fijado en el registro
        const currencySelect = page.locator('select').filter({ hasText: 'EUR — Euro' });
        await expect(currencySelect).toBeVisible();
        await currencySelect.selectOption('MXN');
        await expect(page.getByText('Se fija al crear la cuenta')).toBeVisible();

        await page.getByRole('button', { name: 'Crear Cuenta' }).click();

        // Login automático → header del dashboard
        await expect(page.getByText('Nueva Transacción')).toBeVisible();
        await expect(page.getByText('Balance Actual').first()).toBeVisible();

        // La moneda elegida queda persistida en settings
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const res = await fetch(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } });
        const settings = await res.json();
        expect(settings.currency).toBe('MXN');
    });

    test('crear transacción → aparece en la tabla', async () => {
        await page.goto('/');
        await page.getByText('Nueva Transacción').click();

        // Modal: descripción (text) e importe (number) son únicos por tipo
        await page.locator('input[type="text"]').first().fill('E2E Compra supermercado');
        await page.locator('input[type="number"]').first().fill('123.45');

        await page.getByRole('button', { name: 'Guardar' }).click();

        // La fila aparece en la tabla con monto y badge Confirmado
        const row = page.locator('tr', { hasText: 'E2E Compra supermercado' });
        await expect(row).toBeVisible();
        await expect(row.getByText('-123,45')).toBeVisible();
        await expect(row.getByText('Confirmado')).toBeVisible();
    });

    test('confirmar una transacción pendiente desde la tabla (✓ manual)', async () => {
        await page.goto('/');

        // Seed vía API: una transacción planificada para HOY
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const today = new Date();
        const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const res = await fetch(`${API}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ type: 'expense', category: 'cat_transport', amount: 25, description: 'E2E Metro pendiente', date, status: 'planned' })
        });
        expect(res.status).toBe(201);

        await page.reload();
        const row = page.locator('tr', { hasText: 'E2E Metro pendiente' });
        await expect(row.getByText('Pendiente', { exact: true })).toBeVisible();

        // Hover para revelar acciones (opacity-0 → group-hover) y confirmar
        await row.hover();
        await row.locator('button[title="Confirmar"]').click();

        await expect(row.getByText('Confirmado')).toBeVisible();
        await expect(row.getByText('Pendiente', { exact: true })).toHaveCount(0);
    });

    test('presupuestos: guardar límite y ver resumen con alerta visual', async () => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Presupuestos' }).click();

        // Todas las categorías son editables (onboarding sin gasto previo)
        const housingRow = page.locator('div.space-y-2', { hasText: 'Vivienda' }).first();
        await housingRow.locator('input[type="number"]').fill('500');

        await page.getByRole('button', { name: 'Guardar presupuestos' }).click();
        await expect(page.getByText('Presupuestos guardados')).toBeVisible();

        // Resumen con total presupuestado + barra de consumo
        await expect(page.getByText('Presupuesto total')).toBeVisible();
        await expect(page.getByText('Gastado')).toBeVisible();

        // La verdad importa: el límite persistió en el servidor para el mes actual
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const now = new Date();
        const res = await fetch(`${API}/budgets?month=${now.getMonth()}&year=${now.getFullYear()}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const budgets = await res.json();
        expect(budgets.some(b => b.category === 'cat_housing' && b.amount === 500)).toBe(true);
    });

    test.afterAll(async () => {
        // Limpieza del usuario E2E y sus datos (BD real de Turso)
        const { default: db } = await import(join(ROOT, 'server', 'db.js'));
        const u = await db.execute('SELECT id FROM users WHERE email = ?', [EMAIL]);
        if (u.rows.length > 0) {
            const id = u.rows[0].id;
            await db.execute('DELETE FROM transactions WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM budgets WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM user_notifications WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM user_settings WHERE user_id = ?', [id]);
            await db.execute('DELETE FROM users WHERE id = ?', [id]);
            console.log(`\n🧹 usuario E2E limpiado: ${EMAIL}`);
        }
    });
});
