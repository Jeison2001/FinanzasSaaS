import { useState, useEffect, useRef, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from './useAuth';

/**
 * Resumen consolidado del patrimonio: totales de cuentas, tarjetas y
 * préstamos + netWorth, todo derivado en el server por agregación SQL.
 * `overview` nace en null para que el panel distinga "aún sin datos" de
 * "datos vacíos". App.jsx llama a reload() tras crear/editar movimientos
 * para mantener el overview sincronizado.
 */
export const useOverview = () => {
    const { token } = useAuth();
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(false);
    const requestIdRef = useRef(0);

    const reload = useCallback(async () => {
        if (!token) return;
        const myId = ++requestIdRef.current;
        setLoading(true);
        try {
            const res = await axiosClient.get('/overview');
            if (myId !== requestIdRef.current) return; // respuesta obsoleta
            setOverview(res.data);
        } catch (err) {
            console.error('Failed to fetch overview:', err);
        } finally {
            if (myId === requestIdRef.current) setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { overview, loading, reload };
};
