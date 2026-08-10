import { useState, useCallback } from 'react';

/**
 * Estado de los filtros del historial. El filtrado real ocurre en el
 * servidor (GET /transactions con query params); este hook solo gestiona
 * el estado local que se pasa al hook de transacciones.
 */
export const useFilters = () => {
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const clearAllFilters = useCallback(() => {
        setFilterType('all');
        setFilterStatus('all');
        setSearchQuery('');
        setFilterMonth('');
        setFilterYear('');
        setStartDate('');
        setEndDate('');
    }, []);

    return {
        filters: {
            type: filterType,
            status: filterStatus,
            search: searchQuery,
            month: filterMonth,
            year: filterYear,
            startDate,
            endDate
        },
        setters: { setFilterType, setFilterStatus, setSearchQuery, setFilterMonth, setFilterYear, setStartDate, setEndDate },
        clearAllFilters
    };
};
