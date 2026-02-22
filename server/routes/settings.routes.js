import express from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { updateSettingsSchema } from '../schemas/settings.schema.js';

const router = express.Router();

router.use(authenticateToken); // Apply to all settings routes
router.get('/', getSettings);
router.put('/', validate(updateSettingsSchema), updateSettings);

export default router;
