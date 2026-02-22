import db from '../db.js';

export const getUsers = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admins only.' });

    try {
        const usersResult = await db.execute(`
            SELECT u.id, u.email, u.created_at, u.last_login_at, COUNT(t.id) as transaction_count 
            FROM users u
            LEFT JOIN transactions t ON u.id = t.user_id
            WHERE u.role = 'client'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json(usersResult.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};
