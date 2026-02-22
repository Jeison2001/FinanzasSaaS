import { create } from 'zustand';

export const useAppStore = create((set) => ({
    lang: 'es',
    currency: 'EUR',
    savingsGoal: 10000,
    activeTab: 'transactions',
    setLang: (lang) => set({ lang }),
    setCurrency: (currency) => set({ currency }),
    setSavingsGoal: (savingsGoal) => set({ savingsGoal }),
    setActiveTab: (activeTab) => set({ activeTab })
}));
