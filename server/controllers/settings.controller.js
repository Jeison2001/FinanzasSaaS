import db from '../db.js';

export const getSettings = async (req, res) => {
    try {
        const settingsResult = await db.execute({
            sql: 'SELECT savings_goal, currency, language, timezone FROM user_settings WHERE user_id = ?',
            args: [req.user.id]
        });
        res.json(settingsResult.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Failed to get settings' });
    }
};

export const updateSettings = async (req, res) => {
    const { savings_goal, currency, language, timezone = null } = req.body;
    try {
        await db.execute({
            sql: `
                INSERT INTO user_settings (user_id, savings_goal, currency, language, timezone)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    savings_goal = excluded.savings_goal,
                    currency = excluded.currency,
                    language = excluded.language,
                    timezone = COALESCE(excluded.timezone, user_settings.timezone)
            `,
            args: [req.user.id, savings_goal, currency, language, timezone]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
