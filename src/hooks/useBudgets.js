import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from './useAuth';

/**
 * Gestión de presupuestos mensuales por categoría.
 * GET /budgets?month&year para listar, PUT /budgets para reemplazar el conjunto.
 */
export const useBudgets = (month, year) => {
    const { token } = useAuth();
    const [budgets, setBudgets] = useState([]); // [{category, amount}]
    const [loading, setLoading] = useState(false);

    const fetchBudgets = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axiosClient.get(`/budgets?month=${month}&year=${year}`);
            setBudgets(res.data);
        } catch (err) {
            console.error('Failed to fetch budgets:', err);
        } finally {
            setLoading(false);
        }
    }, [token, month, year]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    const saveBudgets = async (items) => {
        try {
            const res = await axiosClient.put('/budgets', { month, year, items });
            if (res.status === 200) {
                setBudgets(items.filter(i => i.amount > 0));
            }
            return { ok: true };
        } catch (err) {
            console.error('Failed to save budgets:', err);
            return { ok: false, error: err.response?.data?.error || 'Failed to save budgets' };
        }
    };

    return { budgets, loading, saveBudgets };
};
