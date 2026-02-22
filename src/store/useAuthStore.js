import { create } from 'zustand';

export const useAuthStore = create((set) => ({
    token: localStorage.getItem('token') || null,
    role: localStorage.getItem('role') || null,
    isAuthenticated: !!localStorage.getItem('token'),

    login: (token, role) => {
        localStorage.setItem('token', token);
        localStorage.setItem('role', role);
        set({ token, role, isAuthenticated: true });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        set({ token: null, role: null, isAuthenticated: false });
    }
}));
