/**
 * E2E — feature Entidades: cuentas, tarjetas y su integración con los
 * movimientos. Flujo serial del contrato: registro → crear cuenta → ingreso
 * → saldo en panel → crear tarjeta → compra con tarjeta → uso en panel
 * → huérfanos → préstamo (modo cuota) → transferencia → responsive 375px.
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
const ORPHAN_ACCOUNT_NAME = 'Cuenta E2E Huérfanos';
const LOAN_ACCOUNT_NAME = 'Cuenta Préstamo E2E';
const LOAN_NAME = 'Préstamo E2E Cuota';

/**
 * Regex de importe es-ES tolerante a la agrupación de miles de ICU: 12000 se
 * pinta "12.000,00" (5+ dígitos agrupan) y 1000 "1000,00" (minimumGroupingDigits=2
 * del CLDR). El VALOR exigido es exacto; solo el punto de miles es opcional.
 */
const moneyRe = (v) => new RegExp(
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replaceAll('.', '\\.?')
);

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

    test('huérfanos: banner con el neto exacto → adoptar → banner fuera y saldo neto en la fila', async () => {
        // Sembrar 2 movimientos históricos SIN cuenta vía API (500 − 200 = 300)
        // ANTES de crear la cuenta de este test: heredan la ruta legacy
        // pre-entidades (income/expense sin account_id son válidos en server).
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const seed = async (body) => {
            const res = await fetch(`${API}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            expect(res.status).toBe(201);
        };
        await seed({ type: 'income', category: 'cat_salary', amount: 500, description: 'E2E huérfano ingreso', date: '2026-01-10', status: 'completed' });
        await seed({ type: 'expense', category: 'cat_food', amount: 200, description: 'E2E huérfano gasto', date: '2026-01-11', status: 'completed' });

        // Crear la cuenta desde el panel: el refresh tras guardar trae el
        // overview con los huérfanos → banner ámbar visible con el neto.
        await page.getByRole('button', { name: 'Nueva Cuenta' }).click();
        const form = page.locator('form').filter({ hasText: 'Saldo inicial' });
        await form.locator('input[type="text"]').fill(ORPHAN_ACCOUNT_NAME);
        await form.locator('input[type="number"]').fill('0');
        await form.getByRole('button', { name: 'Guardar' }).click();

        const banner = page.locator('div.bg-amber-50', { hasText: 'movimientos históricos' });
        await expect(banner).toBeVisible();
        await expect(banner.getByText(/2 movimientos históricos sin cuenta/)).toBeVisible();
        await expect(banner.getByText(/300,00/)).toBeVisible(); // neto: 500 − 200

        // Adoptar en la cuenta nueva: window.confirm nativo → aceptar.
        const bannerSelect = banner.locator('select');
        await expect(bannerSelect.locator('option', { hasText: ORPHAN_ACCOUNT_NAME })).toBeAttached();
        await bannerSelect.selectOption({ label: ORPHAN_ACCOUNT_NAME });
        page.once('dialog', (dialog) => dialog.accept());
        await banner.getByRole('button', { name: 'Asignar a esta cuenta' }).click();

        // El banner desaparece (overview recargado: orphans.count = 0) y la
        // fila de la cuenta muestra el saldo neto derivado por el server.
        await expect(banner).toHaveCount(0);
        const accRow = page.locator('div.bg-slate-50.rounded-2xl', { hasText: ORPHAN_ACCOUNT_NAME });
        await expect(accRow.getByText(/300,00/)).toBeVisible();

        // La verdad importa: agregación SQL del server, cero huérfanos.
        const res = await fetch(`${API}/overview`, { headers: { Authorization: `Bearer ${token}` } });
        const overview = await res.json();
        expect(overview.orphans.count).toBe(0);
        const adopted = overview.accounts.find(a => a.name === ORPHAN_ACCOUNT_NAME);
        expect(adopted.balance).toBe(300);
    });

    test('préstamo en modo cuota: live-info con tasa implícita y saldo derivado en el panel', async () => {
        // Cuenta para el pago del préstamo (saldo inicial 0: el server no exige
        // saldo suficiente — loan_payment con account_id simplemente resta).
        await page.getByRole('button', { name: 'Nueva Cuenta' }).click();
        const accForm = page.locator('form').filter({ hasText: 'Saldo inicial' });
        await accForm.locator('input[type="text"]').fill(LOAN_ACCOUNT_NAME);
        await accForm.locator('input[type="number"]').fill('0');
        await accForm.getByRole('button', { name: 'Guardar' }).click();
        await expect(page.getByText(LOAN_ACCOUNT_NAME)).toBeVisible();

        // Nuevo préstamo en modo 'Por cuota mensual': capital 10000, 12 cuotas
        // de 1000 (total a pagar 12000 > capital → tasa implícita > 0).
        await page.getByRole('button', { name: 'Nuevo Préstamo' }).click();
        const form = page.locator('form').filter({ hasText: 'Monto del préstamo' });
        await form.locator('input[type="text"]').fill(LOAN_NAME);
        await form.locator('input[type="number"]').nth(0).fill('10000'); // capital
        await form.locator('input[type="number"]').nth(1).fill('12');    // cuotas
        await form.getByRole('button', { name: 'Por cuota mensual' }).click();
        await form.locator('input[type="number"]').nth(2).fill('1000');  // cuota

        // Live-info ANTES de guardar: la tasa implícita estimada. El cliente
        // replica loan.utils en unidades → 35.07% para 10000 a 12×1000
        // (toFixed(2) usa '.' como separador decimal, no es locale-aware).
        const liveInfo = form.locator('div.bg-indigo-50');
        await expect(liveInfo).toBeVisible();
        await expect(liveInfo.getByText('Tasa implícita')).toBeVisible();
        await expect(liveInfo.getByText(/35\.07%/)).toBeVisible();

        await form.getByRole('button', { name: 'Guardar' }).click();

        // Card del préstamo en el panel: modelo total − pagado = 12 × 1000 − 0
        // (es-ES agrupa 5+ dígitos: "12.000,00"; moneyRe tolera el punto).
        const loanRow = page.locator('div.bg-slate-50.rounded-2xl', { hasText: LOAN_NAME });
        await expect(loanRow.getByText(moneyRe(12000))).toBeVisible();
        await expect(loanRow.getByText(/0 de 12/)).toBeVisible();

        // La verdad importa: remaining/cuotas/tasa los fija el server en céntimos
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const res = await fetch(`${API}/loans`, { headers: { Authorization: `Bearer ${token}` } });
        const loans = await res.json();
        expect(loans).toHaveLength(1);
        expect(loans[0].remaining).toBeCloseTo(12000, 2);
        expect(loans[0].installmentsPaid).toBe(0);
        expect(loans[0].monthly_payment_amount).toBeCloseTo(1000, 2);
        expect(loans[0].annual_rate_pct).toBeCloseTo(35.07, 2);

        // Pago de préstamo desde el modal: préstamo (requerido) + cuenta de salida
        await page.getByText('Nueva Transacción').click();
        const modal = page.locator('div.fixed.inset-0');
        await modal.getByRole('button', { name: 'Pago de préstamo' }).click();

        const loanSelect = modal.locator('select').filter({ has: page.locator('option', { hasText: LOAN_NAME }) });
        await expect(loanSelect).toBeVisible();
        await expect(loanSelect).toHaveAttribute('required', '');
        await loanSelect.selectOption({ label: LOAN_NAME });

        const payAccountSelect = modal.locator('select').filter({ has: page.locator('option', { hasText: LOAN_ACCOUNT_NAME }) });
        await expect(payAccountSelect).toBeVisible();
        await payAccountSelect.selectOption({ label: LOAN_ACCOUNT_NAME });

        await modal.locator('input[type="text"]').first().fill('E2E Pago cuota préstamo');
        await modal.locator('input[type="number"]').first().fill('1000');
        await modal.getByRole('button', { name: 'Guardar' }).click();
        await expect(modal).toHaveCount(0);

        // Panel: 1 de 12 cuotas y saldo pendiente 11000 (12000 − 1000), ambos
        // derivados por agregación SQL — el refresh del panel tras la mutación
        // de movimientos es el mismo contrato que cubre el test del ingreso.
        await expect(loanRow.getByText(/1 de 12/)).toBeVisible();
        await expect(loanRow.getByText(moneyRe(11000))).toBeVisible();

        const res2 = await fetch(`${API}/loans`, { headers: { Authorization: `Bearer ${token}` } });
        const loans2 = await res2.json();
        expect(loans2[0].remaining).toBeCloseTo(11000, 2);
        expect(loans2[0].installmentsPaid).toBe(1); // cuota completa abonada
    });

    test('transferencia entre cuentas: saldos derivados en ambos lados', async () => {
        // Saldos ANTES (derivados del server): origen con saldo, destino distinto.
        // Hay 3 cuentas al llegar aquí; se usan las del describe sin crear nuevas.
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const res = await fetch(`${API}/overview`, { headers: { Authorization: `Bearer ${token}` } });
        const overview = await res.json();
        const origen = overview.accounts.find(a => a.name === ACCOUNT_NAME);
        const destino = overview.accounts.find(a => a.name === ORPHAN_ACCOUNT_NAME);
        expect(origen.balance).toBeGreaterThan(0);
        expect(destino.balance).toBeGreaterThan(0);

        await page.getByText('Nueva Transacción').click();
        const modal = page.locator('div.fixed.inset-0');
        await modal.getByRole('button', { name: 'Transferencia' }).click();

        // Ambos selects listan TODAS las cuentas: se distinguen por su label
        // (sin htmlFor) a través del wrapper .space-y-1 que lo contiene.
        const origenWrap = modal.locator('div.space-y-1').filter({ hasText: 'Cuenta origen' });
        const destinoWrap = modal.locator('div.space-y-1').filter({ hasText: 'Cuenta destino' });
        await origenWrap.locator('select').selectOption({ label: ACCOUNT_NAME });
        await destinoWrap.locator('select').selectOption({ label: ORPHAN_ACCOUNT_NAME });

        await modal.locator('input[type="text"]').first().fill('E2E Transferencia entre cuentas');
        await modal.locator('input[type="number"]').first().fill('100');
        await modal.getByRole('button', { name: 'Guardar' }).click();
        await expect(modal).toHaveCount(0);

        // Panel: el saldo del origen baja 100 y el del destino sube 100 —
        // saldos derivados por agregación SQL (flujo −origen/+destino).
        const accRowOrigen = page.locator('div.bg-slate-50.rounded-2xl', { hasText: ACCOUNT_NAME });
        const accRowDestino = page.locator('div.bg-slate-50.rounded-2xl', { hasText: ORPHAN_ACCOUNT_NAME });
        await expect(accRowOrigen.getByText(moneyRe(origen.balance - 100))).toBeVisible();
        await expect(accRowDestino.getByText(moneyRe(destino.balance + 100))).toBeVisible();

        // La verdad importa: el server refleja el mismo movimiento neto
        const res2 = await fetch(`${API}/overview`, { headers: { Authorization: `Bearer ${token}` } });
        const after = await res2.json();
        expect(after.accounts.find(a => a.name === ACCOUNT_NAME).balance).toBe(origen.balance - 100);
        expect(after.accounts.find(a => a.name === ORPHAN_ACCOUNT_NAME).balance).toBe(destino.balance + 100);
    });

    test('responsive móvil 375px: sin scroll horizontal en los cuatro tabs', async () => {
        // El ask enumera CUATRO tabs (Historial, Presupuestos, Entidades, Informes
        // Visuales) aunque su titular diga "tres": se cubren los cuatro. Cada tab
        // espera su marcador propio visible antes de medir (los datos ya están
        // cargados; el swap de activeTab es estado React síncrono).
        await page.setViewportSize({ width: 375, height: 720 });

        const tabs = [
            { name: 'Historial y Planificación', ready: () => page.getByPlaceholder('Buscar...') },
            { name: 'Presupuestos', ready: () => page.getByRole('button', { name: 'Guardar presupuestos' }) },
            { name: 'Entidades', ready: () => page.getByRole('button', { name: 'Nueva Cuenta' }) },
            // 'Descargar PDF' NO sirve de marcador: su span es hidden sm:inline
            // (invisible a 375px) — se usa el heading de datos del informe.
            { name: 'Informes Visuales', ready: () => page.getByText('Gastos por Categoría') },
        ];
        for (const { name, ready } of tabs) {
            await page.getByRole('button', { name }).click();
            await expect(ready()).toBeVisible();
            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            expect(scrollWidth).toBeLessThanOrEqual(375 + 2); // tolerancia 2px
        }

        await page.setViewportSize({ width: 1280, height: 720 });
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
