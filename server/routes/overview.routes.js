import express from 'express';
import { getOverview } from '../controllers/overview.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/', getOverview);

export default router;
