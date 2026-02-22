import { useState, useMemo } from 'react';

/**
 * Gestiona los filtros del historial de transacciones.
 * Soporta filtro por tipo, búsqueda de texto, mes/año y rango de fechas.
 * filteredTransactions se recalcula con useMemo — no genera renders extras.
 */
export const useFilters = (transactions) => {
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const filteredTransactions = useMemo(() => {
        return transactions.filter(item => {
            if (filterType !== 'all' && item.type !== filterType) return false;

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!item.description.toLowerCase().includes(query) && !item.amount.toString().includes(query)) return false;
            }

            const itemDate = new Date(item.date);
            if (filterMonth !== '' && itemDate.getMonth() !== parseInt(filterMonth)) return false;
            if (filterYear !== '' && itemDate.getFullYear() !== parseInt(filterYear)) return false;
            if (startDate && new Date(item.date) < new Date(startDate)) return false;
            if (endDate && new Date(item.date) > new Date(endDate)) return false;

            return true;
        });
    }, [transactions, filterType, searchQuery, filterMonth, filterYear, startDate, endDate]);

    const clearAllFilters = () => {
        setFilterType('all');
        setSearchQuery('');
        setFilterMonth('');
        setFilterYear('');
        setStartDate('');
        setEndDate('');
    };

    return {
        filters: { filterType, searchQuery, filterMonth, filterYear, startDate, endDate },
        setters: { setFilterType, setSearchQuery, setFilterMonth, setFilterYear, setStartDate, setEndDate },
        filteredTransactions,
        clearAllFilters
    };
};
