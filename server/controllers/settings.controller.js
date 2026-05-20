import db from '../db.js';

export const getSettings = async (req, res) => {
    try {
        const settingsResult = await db.execute({
            sql: 'SELECT savings_goal, currency, language FROM user_settings WHERE user_id = ?',
            args: [req.user.id]
        });
        res.json(settingsResult.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Failed to get settings' });
    }
};

export const updateSettings = async (req, res) => {
    const { savings_goal, currency, language } = req.body;
    try {
        await db.execute({
            sql: `
                INSERT INTO user_settings (user_id, savings_goal, currency, language)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    savings_goal = excluded.savings_goal,
                    currency = excluded.currency,
                    language = excluded.language
            `,
            args: [req.user.id, savings_goal, currency, language]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

