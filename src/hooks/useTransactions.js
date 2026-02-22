import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

const API_BASE = import.meta.env.VITE_API_URL;
if (!API_BASE) {
    throw new Error("System configuration error: VITE_API_URL not defined.");
}
const API_URL = `${API_BASE}/api/transactions`;

/**
 * Gestiona el estado y las operaciones CRUD de transacciones.
 * El GET /api/transactions también dispara el procesado de recurrencias en el servidor.
 */
export const useTransactions = () => {
    const { token } = useAuth();
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        if (!token) return;
        fetch(API_URL, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => setTransactions(data))
            .catch(err => console.error('Failed to fetch transactions:', err));
    }, [token]);

    const addTransaction = async (newTx) => {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newTx)
            });
            if (res.ok) {
                // Recarga completa para reflejar también la ocurrencia futura generada en el servidor
                const fresh = await fetch(API_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                setTransactions(await fresh.json());
            }
        } catch (err) {
            console.error('Failed to add transaction:', err);
        }
    };

    const deleteTransaction = async (id) => {
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setTransactions(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Failed to delete transaction:', err);
        }
    };

    const editTransaction = async (id, updatedTx) => {
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(updatedTx)
            });
            if (res.ok) {
                const saved = await res.json();
                setTransactions(prev => prev.map(t => t.id === id ? saved : t));
            }
        } catch (err) {
            console.error('Failed to edit transaction:', err);
        }
    };

    return { transactions, addTransaction, deleteTransaction, editTransaction };
};
