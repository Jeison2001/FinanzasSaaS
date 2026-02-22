import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export const useReports = (refreshTrigger, month = '', year = '', startDate = '', endDate = '') => {
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
                const queryParams = new URLSearchParams();
                if (startDate) queryParams.append('startDate', startDate);
                if (endDate) queryParams.append('endDate', endDate);
                if (month !== '') queryParams.append('month', month);
                if (year !== '') queryParams.append('year', year);

                const url = `/transactions/reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
                const res = await axiosClient.get(url);
                setReportsData(res.data);
            } catch (err) {
                console.error('Failed to fetch reports:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [refreshTrigger, month, year, startDate, endDate]);

    return { reportsData, loading };
};
