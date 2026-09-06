/**
 * Configuración Playwright E2E.
 * - Backend propio en :3997 (Turso real, igual que la suite de integración)
 * - Frontend vite dev en :5173 apuntando al backend local (VITE_API_URL override)
 * - Navegador: Edge del sistema (channel 'msedge') — evita descargar Chromium,
 *   el CDN de Playwright puede estar bloqueado en entornos restringidos.
 * Usuario de prueba único por corrida, auto-limpiado al finalizar.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 90_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:5173',
        channel: 'msedge',
        viewport: { width: 1280, height: 800 },
        locale: 'es-ES',
    },
    webServer: [
        {
            command: 'node server/index.js',
            port: 3997,
            timeout: 60_000,
            reuseExistingServer: !process.env.CI,
            env: { PORT: '3997' },
        },
        {
            command: 'npm run dev',
            port: 5173,
            timeout: 120_000,
            reuseExistingServer: !process.env.CI,
            env: { VITE_API_URL: 'http://localhost:3997' },
        },
    ],
});
