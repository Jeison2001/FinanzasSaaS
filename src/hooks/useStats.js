import { useMemo } from 'react';

/**
 * Calcula KPIs financieros a partir del listado de transacciones.
 * - actualBalance: ingresos confirmados - gastos confirmados.
 * - plannedIncome/Expense: suma total (confirmados + pendientes).
 * - goalPercent: porcentaje del balance actual respecto al objetivo de ahorro.
 */
export const useStats = (transactions, savingsGoal) => {
    const stats = useMemo(() => {
        const totals = transactions.reduce((acc, curr) => {
            let amount = parseFloat(curr.amount);
            if (isNaN(amount)) amount = 0;

            if (curr.type === 'income') {
                if (curr.status === 'completed') acc.actualIncome += amount;
                acc.plannedIncome += amount;
            } else {
                if (curr.status === 'completed') acc.actualExpense += amount;
                acc.plannedExpense += amount;
            }
            return acc;
        }, { actualIncome: 0, actualExpense: 0, plannedIncome: 0, plannedExpense: 0 });

        const balance = totals.actualIncome - totals.actualExpense;
        const goalPercent = Math.min(Math.round((balance / (savingsGoal || 1)) * 100), 100);

        return {
            ...totals,
            actualBalance: balance,
            plannedBalance: totals.plannedIncome - totals.plannedExpense,
            goalPercent: Math.max(0, goalPercent)
        };
    }, [transactions, savingsGoal]);

    return stats;
};
