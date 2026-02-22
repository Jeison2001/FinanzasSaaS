import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import axiosClient from '../api/axiosClient';

/**
 * Gestiona el estado y las operaciones CRUD de transacciones.
 * El GET /api/transactions también dispara el procesado de recurrencias en el servidor.
 */
export const useTransactions = () => {
    const { token } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const LIMIT = 50;

    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    const fetchTransactions = async (currentOffset = 0, append = false) => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axiosClient.get(`/transactions?limit=${LIMIT}&offset=${currentOffset}`);
            const data = res.data;
            if (data.length < LIMIT) setHasMore(false);
            else setHasMore(true);

            if (append) {
                setTransactions(prev => [...prev, ...data]);
            } else {
                setTransactions(data);
            }
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setOffset(0);
        fetchTransactions(0, false);
    }, [token]);

    const loadMore = () => {
        const nextOffset = offset + LIMIT;
        setOffset(nextOffset);
        fetchTransactions(nextOffset, true);
    };

    const addTransaction = async (newTx) => {
        try {
            const res = await axiosClient.post('/transactions', newTx);
            if (res.status === 201) {
                setOffset(0);
                await fetchTransactions(0, false);
                triggerRefresh();
            }
        } catch (err) {
            console.error('Failed to add transaction:', err);
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
        }
    };

    const editTransaction = async (id, updatedTx) => {
        try {
            const res = await axiosClient.put(`/transactions/${id}`, updatedTx);
            if (res.status === 200) {
                const saved = res.data;
                setTransactions(prev => prev.map(t => t.id === id ? saved : t));
                triggerRefresh();
            }
        } catch (err) {
            console.error('Failed to edit transaction:', err);
        }
    };

    return {
        transactions,
        addTransaction,
        deleteTransaction,
        editTransaction,
        loadMore,
        hasMore,
        loading,
        refreshTrigger
    };
};

