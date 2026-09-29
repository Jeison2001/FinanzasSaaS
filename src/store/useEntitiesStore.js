import { create } from 'zustand';
import axiosClient from '../api/axiosClient';

/**
 * Store compartido de entidades financieras (cuentas, tarjetas, préstamos).
 *
 * Todas las instancias que consumen entidades (EntitiesPanel, modal de
 * transacciones) leen de AQUÍ: montar el modal con el panel abierto no repite
 * los 3 GETs — una única carga por sesión de usuario sirve a las dos vistas
 * y un reload() forzado (mutaciones) actualiza todas a la vez.
 *
 * `loadedToken` acota la caché a la sesión: al cambiar de usuario los datos
 * se recargan (y el logout resetea el store vía useEntities).
 */
let requestId = 0; // guard anti-race global: la respuesta más nueva gana

export const useEntitiesStore = create((set, get) => ({
    accounts: [],       // [{id, name, balance, ...}]
    cards: [],          // [{id, name, used, limit, minPayment, ...}]
    loans: [],          // [{id, name, remaining, paid, ...}]
    loading: false,
    loadedToken: null,  // token con el que se cargaron los datos actuales
    inflightToken: null, // token de la carga en vuelo (dedupe de montajes)

    /** Vacía la caché (logout / cambio de sesión) e invalida respuestas en vuelo. */
    reset: () => {
        requestId += 1;
        set({ accounts: [], cards: [], loans: [], loading: false, loadedToken: null, inflightToken: null });
    },

    /** Carga real de las tres listas. NO llamar directo: pasar por fetch(). */
    _load: async (token) => {
        const myId = ++requestId;
        set({ loading: true });
        try {
            const [accRes, cardRes, loanRes] = await Promise.all([
                axiosClient.get('/accounts'),
                axiosClient.get('/cards'),
                axiosClient.get('/loans')
            ]);
            if (myId !== requestId) return; // respuesta obsoleta (otra carga la superó)
            set({ accounts: accRes.data, cards: cardRes.data, loans: loanRes.data, loading: false, loadedToken: token, inflightToken: null });
        } catch (err) {
            console.error('Failed to fetch entities:', err);
            if (myId === requestId) set({ loading: false, inflightToken: null });
        }
    },

    /**
     * Carga con caché compartida: si los datos ya están cargados para este
     * token (o hay una carga en vuelo para él), no repite los GETs.
     * force=true salta la caché — lo usan reload() tras mutaciones; una carga
     * forzada nueva siempre gana sobre una anterior (requestId).
     */
    fetch: (token, { force = false } = {}) => {
        if (!token) return;
        const { loadedToken, inflightToken } = get();
        if (!force) {
            if (inflightToken === token) return; // ya hay una carga idéntica en vuelo
            if (loadedToken === token) return;   // caché compartida ya válida
        }
        set({ inflightToken: token });
        return get()._load(token);
    },

    /**
     * Recarga forzada de la sesión cargada. Utilizable fuera de React
     * (useEntitiesStore.getState().reload()) — App.jsx la invoca en cada
     * mutación de movimientos para refrescar saldos/usados/pagados derivados.
     */
    reload: () => {
        const { loadedToken, fetch } = get();
        if (loadedToken) fetch(loadedToken, { force: true });
    }
}));
