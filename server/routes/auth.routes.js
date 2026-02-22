import express from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { forgotPassword, resetPassword } from '../controllers/password.controller.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/password.schema.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
