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
            sql: 'UPDATE user_settings SET savings_goal = ?, currency = ?, language = ? WHERE user_id = ?',
            args: [savings_goal, currency, language, req.user.id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
