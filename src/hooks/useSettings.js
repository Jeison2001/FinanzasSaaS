/**
 * Hook para cargar y persistir preferencias del usuario desde/hacia la BD.
 * Sincroniza automáticamente con el store de Zustand al cargar.
 */
import { useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { useAppStore } from '../store/useAppStore';

export const useSettings = (isAuthenticated) => {
    const { setLang, setCurrency, setSavingsGoal } = useAppStore();

    // Carga de preferencias al iniciar sesión
    useEffect(() => {
        if (!isAuthenticated) return;

        const loadSettings = async () => {
            try {
                const res = await axiosClient.get('/settings');
                const { currency, language, savings_goal } = res.data;
                if (currency) setCurrency(currency);
                if (language) setLang(language);
                if (savings_goal != null) setSavingsGoal(savings_goal);
            } catch (err) {
                console.warn('[useSettings] No se pudieron cargar las preferencias:', err?.response?.status);
            }
        };

        loadSettings();
    }, [isAuthenticated]);

    // Función para persistir cualquier cambio en la BD
    const saveSettings = useCallback(async (patch) => {
        try {
            // Leemos el estado actual del store para completar los campos requeridos
            const { lang, currency, savingsGoal } = useAppStore.getState();
            await axiosClient.put('/settings', {
                savings_goal: patch.savings_goal ?? savingsGoal,
                currency: patch.currency ?? currency,
                language: patch.language ?? lang,
            });
        } catch (err) {
            console.error('[useSettings] Error al guardar preferencias:', err?.response?.data ?? err.message);
        }
    }, []);

    return { saveSettings };
};
