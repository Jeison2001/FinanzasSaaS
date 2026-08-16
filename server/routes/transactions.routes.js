import express from 'express';
import { getTransactions, getStats, getReports, createTransaction, updateTransaction, deleteTransaction, exportTransactions, importTransactions } from '../controllers/transactions.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { importLimiter } from '../middlewares/rateLimiter.middleware.js';
import { addTransactionSchema, updateTransactionSchema, importTransactionsSchema } from '../schemas/transaction.schema.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/stats', getStats);
router.get('/reports', getReports);
router.get('/export', exportTransactions);
router.get('/', getTransactions);

router.post('/import', importLimiter, validate(importTransactionsSchema), importTransactions);
router.post('/', validate(addTransactionSchema), createTransaction);
router.put('/:id', validate(updateTransactionSchema), updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
