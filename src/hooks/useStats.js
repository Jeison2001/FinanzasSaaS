import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from './useAuth';

/**
 * Obtiene los KPIs financieros del período seleccionado desde el servidor.
 * mode: 'month' (default) | 'year' | 'all'.
 * goalPercent se calcula sobre lifetimeBalance (saldo histórico total),
 * no sobre el saldo del período — la meta de ahorro no depende del filtro.
 */
export const useStats = (refreshTrigger, savingsGoal, mode = 'month', month = '', year = '') => {
    const { token } = useAuth();
    const [stats, setStats] = useState({
        actualIncome: 0,
        actualExpense: 0,
        plannedIncome: 0,
        plannedExpense: 0,
        overdueIncome: 0,
        overdueExpense: 0,
        lifetimeBalance: 0,
        actualBalance: 0,
        plannedBalance: 0,
        goalPercent: 0
    });

    useEffect(() => {
        if (!token) return;

        const fetchStats = async () => {
            try {
                const params = new URLSearchParams({ mode });
                if (month !== '') params.append('month', month);
                if (year !== '') params.append('year', year);

                const res = await axiosClient.get(`/transactions/stats?${params.toString()}`);
                const totals = res.data;
                const balance = totals.actualIncome - totals.actualExpense;

                // Evitamos NaN o infinitos si la meta es 0
                const safeGoal = savingsGoal > 0 ? savingsGoal : 1;
                const goalPercent = Math.min(Math.round((totals.lifetimeBalance / safeGoal) * 100), 100);

                setStats({
                    ...totals,
                    actualBalance: balance,
                    plannedBalance: totals.plannedIncome - totals.plannedExpense,
                    goalPercent: Math.max(0, goalPercent)
                });
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            }
        };

        fetchStats();
    }, [refreshTrigger, savingsGoal, token, mode, month, year]);

    return stats;
};
