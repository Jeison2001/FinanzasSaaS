import express from 'express';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../controllers/accounts.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { addAccountSchema, updateAccountSchema } from '../schemas/account.schema.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAccounts);
router.post('/', validate(addAccountSchema), createAccount);
router.put('/:id', validate(updateAccountSchema), updateAccount);
router.delete('/:id', deleteAccount);

export default router;
