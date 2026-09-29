import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useEntitiesStore } from '../store/useEntitiesStore';

/**
 * Fachada de lectura de entidades sobre el store compartido de Zustand
 * (useEntitiesStore). Cada lista viene del server con sus derivados ya
 * calculados por agregación SQL (balance de cuenta, usado de tarjeta, pagado
 * de préstamo) — el frontend nunca los recalcula ni los almacena.
 *
 * Caché COMPARTIDA entre instancias: EntitiesPanel y AddTransactionModal
 * montan este hook a la vez y consumen UNA sola carga (el store deduplica
 * los GETs); reload() fuerza la recarga tras mutaciones de entidades y
 * actualiza todas las instancias suscritas.
 */
export const useEntities = () => {
    const { token } = useAuth();
    const accounts = useEntitiesStore(s => s.accounts);
    const cards = useEntitiesStore(s => s.cards);
    const loans = useEntitiesStore(s => s.loans);
    const loading = useEntitiesStore(s => s.loading);
    const fetchEntities = useEntitiesStore(s => s.fetch);

    useEffect(() => {
        if (!token) {
            useEntitiesStore.getState().reset(); // logout: vacía la caché de sesión
            return;
        }
        fetchEntities(token);
    }, [token, fetchEntities]);

    const reload = useCallback(() => {
        if (token) useEntitiesStore.getState().fetch(token, { force: true });
    }, [token]);

    return { accounts, cards, loans, loading, reload };
};
