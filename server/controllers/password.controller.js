import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import db from '../db.js';
import logger from '../logger.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

/**
 * POST /auth/forgot-password
 * Genera un token de reset y envía el email. Siempre responde 200
 * para no revelar si el email existe o no.
 */
export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
        const userResult = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [normalizedEmail]
        });

        // Respuesta genérica aunque el usuario no exista (seguridad)
        if (userResult.rows.length === 0) {
            return res.json({ message: 'Si el email existe, recibirás las instrucciones en breve.' });
        }

        const userId = userResult.rows[0].id;
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

        // Elimina tokens anteriores del usuario para evitar acumulación
        await db.execute({
            sql: 'DELETE FROM password_reset_tokens WHERE user_id = ?',
            args: [userId]
        });

        await db.execute({
            sql: 'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
            args: [token, userId, expiresAt]
        });

        await sendPasswordResetEmail(normalizedEmail, token);

        logger.info({ email: normalizedEmail }, '[forgotPassword] Email de reset enviado');
        res.json({ message: 'Si el email existe, recibirás las instrucciones en breve.' });
    } catch (err) {
        logger.error({ err }, '[forgotPassword] Error');
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
};

/**
 * POST /auth/reset-password
 * Valida el token y actualiza la contraseña.
 */
export const resetPassword = async (req, res) => {
    const { token, password } = req.body;

    try {
        const tokenResult = await db.execute({
            sql: 'SELECT * FROM password_reset_tokens WHERE token = ?',
            args: [token]
        });

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Token inválido o expirado' });
        }

        const row = tokenResult.rows[0];
        if (new Date(row.expires_at) < new Date()) {
            await db.execute({ sql: 'DELETE FROM password_reset_tokens WHERE token = ?', args: [token] });
            return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute({
            sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
            args: [hashedPassword, row.user_id]
        });

        // Invalida el token usado
        await db.execute({ sql: 'DELETE FROM password_reset_tokens WHERE token = ?', args: [token] });

        logger.info({ userId: row.user_id }, '[resetPassword] Contraseña actualizada');
        res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
    } catch (err) {
        logger.error({ err }, '[resetPassword] Error');
        res.status(500).json({ error: 'Error al restablecer la contraseña' });
    }
};
