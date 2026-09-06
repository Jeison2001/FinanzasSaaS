import 'dotenv/config';
const { default: db } = await import('./db.js');
const res = await db.execute("SELECT id, email FROM users WHERE email LIKE 'smoketest_%' OR email LIKE 'debug_%' OR email LIKE 'dupcheck_%' OR email LIKE 'inttest_%'");
for (const u of res.rows) {
    await db.execute('DELETE FROM transactions WHERE user_id = ?', [u.id]);
    await db.execute('DELETE FROM budgets WHERE user_id = ?', [u.id]);
    await db.execute('DELETE FROM user_notifications WHERE user_id = ?', [u.id]);
    await db.execute('DELETE FROM user_settings WHERE user_id = ?', [u.id]);
    await db.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [u.id]);
    await db.execute('DELETE FROM users WHERE id = ?', [u.id]);
    console.log('Limpiado:', u.email);
}
if (res.rows.length === 0) console.log('BD limpia: sin usuarios de prueba residuales.');
process.exit(0);
