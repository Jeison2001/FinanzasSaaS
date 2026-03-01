import db from '../db.js';
import logger from '../logger.js';

export const getNotifications = async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT id, type, message_key, created_at FROM user_notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC',
            args: [req.user.id]
        });
        res.json(result.rows);
    } catch (err) {
        logger.error({ err, userId: req.user.id }, 'Error fetching notifications');
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute({
            sql: 'UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            args: [id, req.user.id]
        });
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        res.json({ success: true });
    } catch (err) {
        logger.error({ err, notificationId: id }, 'Error marking notification as read');
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};
