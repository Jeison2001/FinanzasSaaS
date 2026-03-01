import express from 'express';
import { getNotifications, markAsRead } from '../controllers/notifications.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', authenticateToken, getNotifications);
router.put('/:id/read', authenticateToken, markAsRead);

export default router;
