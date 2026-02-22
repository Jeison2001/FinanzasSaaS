import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from './useAuth';

/**
 * Obtiene los KPIs financieros globales desde el servidor.
 * Reacciona a `refreshTrigger` (cuando se añaden/editan transacciones) y `savingsGoal`.
 */
export const useStats = (refreshTrigger, savingsGoal) => {
    const { token } = useAuth();
    const [stats, setStats] = useState({
        actualIncome: 0,
        actualExpense: 0,
        plannedIncome: 0,
        plannedExpense: 0,
        actualBalance: 0,
        plannedBalance: 0,
        goalPercent: 0
    });

    useEffect(() => {
        if (!token) return;

        const fetchStats = async () => {
            try {
                const res = await axiosClient.get('/transactions/stats');
                const totals = res.data;
                const balance = totals.actualIncome - totals.actualExpense;

                // Evitamos NaN o infinitos si la meta es 0
                const safeGoal = savingsGoal > 0 ? savingsGoal : 1;
                const goalPercent = Math.min(Math.round((balance / safeGoal) * 100), 100);

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
    }, [refreshTrigger, savingsGoal, token]);

    return stats;
};
