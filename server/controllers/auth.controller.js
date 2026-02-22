import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import logger from '../logger.js';
import dotenv from 'dotenv';

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET;

export const register = async (req, res) => {
    const { email, password, role } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
        const checkResult = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [normalizedEmail]
        });

        if (checkResult.rows.length > 0) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const userRole = role === 'admin' ? 'admin' : 'client';

        await db.execute({
            sql: 'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
            args: [id, normalizedEmail, hashedPassword, userRole]
        });

        await db.execute({
            sql: 'INSERT INTO user_settings (user_id) VALUES (?)',
            args: [id]
        });

        const token = jwt.sign({ id, email: normalizedEmail, role: userRole }, SECRET_KEY, { expiresIn: '365d' });
        res.json({ token, role: userRole });
    } catch (err) {
        logger.error({ err }, 'Registration failed');
        res.status(500).json({ error: 'Registration failed' });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
        const userResult = await db.execute({
            sql: 'SELECT * FROM users WHERE email = ?',
            args: [normalizedEmail]
        });

        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid password' });

        await db.execute({
            sql: 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
            args: [user.id]
        });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '365d' });
        res.json({ token, role: user.role });
    } catch (err) {
        logger.error({ err }, 'Login failed');
        res.status(500).json({ error: 'Login failed' });
    }
};
