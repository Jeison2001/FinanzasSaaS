import express from 'express';
import { getLoans, createLoan, updateLoan, deleteLoan } from '../controllers/loans.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { addLoanSchema, updateLoanSchema } from '../schemas/loan.schema.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getLoans);
router.post('/', validate(addLoanSchema), createLoan);
router.put('/:id', validate(updateLoanSchema), updateLoan);
router.delete('/:id', deleteLoan);

export default router;
