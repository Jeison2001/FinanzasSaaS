import express from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { forgotPassword, resetPassword } from '../controllers/password.controller.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/password.schema.js';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
