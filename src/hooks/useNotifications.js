import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuthStore } from '../store/useAuthStore';

export const useNotifications = () => {
    const { isAuthenticated } = useAuthStore();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const res = await axiosClient.get('/notifications');
            setNotifications(res.data);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const dismissNotification = async (id) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.filter(n => n.id !== id));
            await axiosClient.put(`/notifications/${id}/read`);
        } catch (err) {
            console.error('Failed to dismiss notification:', err);
            // Rollback if needed
            fetchNotifications();
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
        } else {
            setNotifications([]);
        }
    }, [isAuthenticated]);

    return {
        notifications,
        loading,
        dismissNotification,
        refreshNotifications: fetchNotifications
    };
};
