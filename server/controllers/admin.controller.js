import db from '../db.js';

export const getUsers = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admins only.' });

    try {
        const usersResult = await db.execute(`
            SELECT u.id, u.email, u.role, u.created_at, u.last_login_at, COUNT(t.id) as transaction_count 
            FROM users u
            LEFT JOIN transactions t ON u.id = t.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json(usersResult.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const resetUserData = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admins only.' });

    const { userId } = req.params;

    try {
        // 1. Eliminar transacciones
        await db.execute({
            sql: 'DELETE FROM transactions WHERE user_id = ?',
            args: [userId]
        });

        // 2. Eliminar notificaciones
        await db.execute({
            sql: 'DELETE FROM user_notifications WHERE user_id = ?',
            args: [userId]
        });

        // 3. Eliminar tokens de restablecimiento de contraseña
        await db.execute({
            sql: 'DELETE FROM password_reset_tokens WHERE user_id = ?',
            args: [userId]
        });

        // 4. Restaurar configuraciones predeterminadas del usuario usando UPSERT
        await db.execute({
            sql: `
                INSERT INTO user_settings (user_id, savings_goal, currency, language)
                VALUES (?, 10000, 'EUR', 'es')
                ON CONFLICT(user_id) DO UPDATE SET
                    savings_goal = 10000,
                    currency = 'EUR',
                    language = 'es'
            `,
            args: [userId]
        });

        res.json({ success: true, message: 'User data has been successfully reset.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reset user data' });
    }
};

