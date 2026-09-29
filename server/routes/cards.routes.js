import express from 'express';
import { getCards, createCard, updateCard, deleteCard } from '../controllers/cards.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { addCardSchema, updateCardSchema } from '../schemas/card.schema.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCards);
router.post('/', validate(addCardSchema), createCard);
router.put('/:id', validate(updateCardSchema), updateCard);
router.delete('/:id', deleteCard);

export default router;
