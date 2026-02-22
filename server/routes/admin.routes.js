import express from 'express';
import { getUsers } from '../controllers/admin.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken); // Apply to all admin routes
router.get('/users', getUsers);

export default router;
