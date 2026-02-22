import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export const useReports = (refreshTrigger) => {
    const [reportsData, setReportsData] = useState({
        expensesByCategory: {},
        incomesBySource: {},
        trendData: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const res = await axiosClient.get('/transactions/reports');
                setReportsData(res.data);
            } catch (err) {
                console.error('Failed to fetch reports:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [refreshTrigger]);

    return { reportsData, loading };
};
