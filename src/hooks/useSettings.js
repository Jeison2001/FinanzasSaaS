/**
 * Hook para cargar y persistir preferencias del usuario desde/hacia la BD.
 * Sincroniza automáticamente con el store de Zustand al cargar.
 */
import { useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../locales';

export const useSettings = (isAuthenticated) => {
    const { setLang, setCurrency, setSavingsGoal } = useAppStore();

    // Carga de preferencias al iniciar sesión
    useEffect(() => {
        if (!isAuthenticated) return;

        const loadSettings = async () => {
            try {
                const res = await axiosClient.get('/settings');
                const { currency, language, savings_goal, timezone } = res.data;
                if (currency) setCurrency(currency);
                if (language) setLang(language);
                if (savings_goal != null) setSavingsGoal(savings_goal);

                // Sincronizar la timezone del dispositivo (el CRON la usa para
                // marcar vencidos en el día local del usuario). Solo si cambió.
                const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
                useAppStore.getState().setTimezone(deviceTz);
                if (deviceTz && deviceTz !== timezone) {
                    await axiosClient.put('/settings', {
                        savings_goal: savings_goal ?? useAppStore.getState().savingsGoal,
                        currency: currency ?? useAppStore.getState().currency,
                        language: language ?? useAppStore.getState().lang,
                        timezone: deviceTz
                    });
                }
            } catch (err) {
                console.warn('[useSettings] No se pudieron cargar las preferencias:', err?.response?.status);
            }
        };

        loadSettings();
    }, [isAuthenticated]);

    // Función para persistir cualquier cambio en la BD. Devuelve {ok} para
    // que la UI no cierre el modal hasta confirmar el guardado.
    const saveSettings = useCallback(async (patch) => {
        try {
            // Leemos el estado actual del store para completar los campos requeridos
            const { lang, currency, savingsGoal, timezone } = useAppStore.getState();
            await axiosClient.put('/settings', {
                savings_goal: patch.savings_goal ?? savingsGoal,
                currency: patch.currency ?? currency,
                language: patch.language ?? lang,
                timezone: patch.timezone ?? timezone ?? undefined,
            });
            return { ok: true };
        } catch (err) {
            console.error('[useSettings] Error al guardar preferencias:', err?.response?.data ?? err.message);
            const { lang: curLang, pushToast } = useAppStore.getState();
            const t = useTranslation(curLang);
            pushToast(err?.response?.data?.error || t('authErrorGeneric'), 'error');
            return { ok: false };
        }
    }, []);

    return { saveSettings };
};
