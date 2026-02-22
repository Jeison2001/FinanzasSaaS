import express from 'express';
import { getTransactions, getStats, getReports, createTransaction, updateTransaction, deleteTransaction } from '../controllers/transactions.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { addTransactionSchema, updateTransactionSchema } from '../schemas/transaction.schema.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/stats', getStats);
router.get('/reports', getReports);
router.get('/', getTransactions);
router.post('/', validate(addTransactionSchema), createTransaction);
router.put('/:id', validate(updateTransactionSchema), updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
