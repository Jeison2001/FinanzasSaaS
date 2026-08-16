import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import axiosClient from '../api/axiosClient';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../locales';

/** Notifica un error de API al usuario vía toast (visible en producción). */
const notifyError = (err) => {
    const { lang, pushToast } = useAppStore.getState();
    const t = useTranslation(lang);
    pushToast(err?.response?.data?.error || t('authErrorGeneric'), 'error');
};

/**
 * Gestiona el estado y las operaciones CRUD de transacciones.
 * El listado es server-side: recibe los filtros, los debouncea (300ms) y
 * pagina sobre el set filtrado con { rows, total }. Un guard anti-race
 * descarta respuestas obsoletas cuando los filtros cambian rápido.
 * `totalAll` es el total sin filtros (primer fetch) — para el EmptyState.
 */
export const useTransactions = (filters = {}) => {
    const { token } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [totalAll, setTotalAll] = useState(0);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const LIMIT = 50;

    const requestIdRef = useRef(0);

    // Debounce: no disparar una petición por cada tecla del buscador
    const [debouncedFilters, setDebouncedFilters] = useState(filters);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedFilters(filters), 300);
        return () => clearTimeout(timer);
    }, [filters]);

    const hasActiveFilters = Object.values(debouncedFilters).some(v => v !== '' && v !== 'all');

    const fetchTransactions = useCallback(async (currentOffset = 0, append = false, isInitial = false) => {
        if (!token) return;
        const myId = ++requestIdRef.current;
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: String(LIMIT), offset: String(currentOffset) });
            Object.entries(debouncedFilters).forEach(([key, value]) => {
                if (value !== '' && value !== 'all') params.append(key, value);
            });

            const res = await axiosClient.get(`/transactions?${params.toString()}`);
            if (myId !== requestIdRef.current) return; // respuesta obsoleta

            const { rows, total } = res.data;
            if (isInitial) setTotalAll(total);
            setHasMore(currentOffset + rows.length < total);
            setTransactions(prev => append ? [...prev, ...rows] : rows);
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
        } finally {
            if (myId === requestIdRef.current) setLoading(false);
        }
    }, [token, debouncedFilters]);

    // Fetch inicial (token) y cada vez que cambian filtros o refreshTrigger
    useEffect(() => {
        if (!token) return;
        setTransactions([]);
        fetchTransactions(0, false, !hasActiveFilters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, debouncedFilters, refreshTrigger]);

    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    const loadMore = () => {
        if (loading || !hasMore) return;
        fetchTransactions(transactions.length, true, false);
    };

    const addTransaction = async (newTx) => {
        try {
            const res = await axiosClient.post('/transactions', newTx);
            if (res.status === 201) {
                await fetchTransactions(0, false, false);
                triggerRefresh();
                return { ok: true };
            }
            return { ok: false };
        } catch (err) {
            console.error('Failed to add transaction:', err);
            notifyError(err);
            return { ok: false };
        }
    };

    const deleteTransaction = async (id) => {
        try {
            const res = await axiosClient.delete(`/transactions/${id}`);
            if (res.status === 200) {
                setTransactions(prev => prev.filter(t => t.id !== id));
                triggerRefresh();
            }
        } catch (err) {
            console.error('Failed to delete transaction:', err);
            notifyError(err);
        }
    };

    const editTransaction = async (id, updatedTx) => {
        try {
            const res = await axiosClient.put(`/transactions/${id}`, updatedTx);
            if (res.status === 200) {
                const saved = res.data;
                setTransactions(prev => prev.map(t => t.id === id ? saved : t));
                triggerRefresh();
                return { ok: true };
            }
            return { ok: false };
        } catch (err) {
            console.error('Failed to edit transaction:', err);
            notifyError(err);
            return { ok: false };
        }
    };

    return {
        transactions,
        totalAll,
        addTransaction,
        deleteTransaction,
        editTransaction,
        loadMore,
        hasMore,
        loading,
        refreshTrigger,
        triggerRefresh
    };
};
