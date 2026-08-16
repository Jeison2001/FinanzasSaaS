import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import db from '../db.js';

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, async (err, payload) => {
        if (err) return res.sendStatus(401);
        try {
            // Rol y pwd_version se leen de la BD en cada petición: un reset de
            // contraseña (pwd_version + 1) o el borrado del usuario invalidan
            // tokens emitidos previamente, sin acortar la expiración global.
            const u = await db.execute({
                sql: 'SELECT id, role, pwd_version FROM users WHERE id = ?',
                args: [payload.id]
            });
            const user = u.rows[0];
            if (!user) return res.sendStatus(401);
            if ((payload.pwd_version || 0) !== (user.pwd_version || 0)) return res.sendStatus(401);
            req.user = { id: user.id, email: payload.email, role: user.role };
            next();
        } catch {
            res.sendStatus(401);
        }
    });
};
