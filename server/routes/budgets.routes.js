import express from 'express';
import { getBudgets, saveBudgets } from '../controllers/budgets.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { saveBudgetsSchema } from '../schemas/budget.schema.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/', getBudgets);
router.put('/', validate(saveBudgetsSchema), saveBudgets);

export default router;
