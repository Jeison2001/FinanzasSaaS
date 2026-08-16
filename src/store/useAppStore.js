import { create } from 'zustand';

export const useAppStore = create((set) => ({
    lang: 'es',
    currency: 'EUR',
    savingsGoal: 10000,
    activeTab: 'transactions',
    // Canal de errores visible al usuario: los hooks notifican aquí y el
    // Toaster los renderiza (console.error se elimina del bundle de producción).
    toasts: [],
    pushToast: (message, type = 'error') => set((s) => ({
        toasts: [...s.toasts.slice(-3), { id: `${Date.now()}_${Math.random()}`, message, type }]
    })),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    setLang: (lang) => set({ lang }),
    setCurrency: (currency) => set({ currency }),
    setSavingsGoal: (savingsGoal) => set({ savingsGoal }),
    setActiveTab: (activeTab) => set({ activeTab })
}));
