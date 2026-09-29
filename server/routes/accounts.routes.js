import express from 'express';
import { getAccounts, createAccount, updateAccount, deleteAccount, adoptOrphans } from '../controllers/accounts.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { addAccountSchema, updateAccountSchema } from '../schemas/account.schema.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAccounts);
router.post('/', validate(addAccountSchema), createAccount);
router.put('/:id', validate(updateAccountSchema), updateAccount);
// Sin body → sin schema Zod (igual que DELETE /:id); la guarda es el
// ownership dentro del controller.
router.post('/:id/adopt-orphans', adoptOrphans);
router.delete('/:id', deleteAccount);

export default router;
