/**
 * Servicio de email con Resend.
 * Documentación: https://resend.com/docs
 */
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const APP_URL = process.env.APP_URL;

if (!RESEND_API_KEY || !FROM_EMAIL || !APP_URL) {
    console.error('FATAL ERROR: RESEND_API_KEY, FROM_EMAIL o APP_URL no están definidos en .env');
    process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

export const sendPasswordResetEmail = async (toEmail, resetToken) => {
    const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

    await resend.emails.send({
        from: FROM_EMAIL,
        to: toEmail,
        subject: 'Restablece tu contraseña — FinanzaSaaS',
        html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Inter, system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 40px 16px;">
            <div style="max-width: 480px; margin: auto; background: white; border-radius: 24px; padding: 40px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: #0f172a; padding: 12px 20px; border-radius: 16px;">
                        <span style="color: #10b981; font-size: 20px; font-weight: 900;">Finanza</span><span style="color: white; font-size: 20px; font-weight: 900;">SaaS</span>
                    </div>
                </div>
                <h2 style="text-align: center; color: #0f172a; font-size: 22px; font-weight: 900; margin: 0 0 12px;">Restablece tu contraseña</h2>
                <p style="color: #64748b; text-align: center; font-size: 14px; line-height: 1.6; margin: 0 0 32px;">
                    Hemos recibido una solicitud para restablecer la contraseña de tu cuenta <strong>${toEmail}</strong>. Si no fuiste tú, ignora este email.
                </p>
                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="${resetUrl}" 
                       style="display: inline-block; background: #10b981; color: white; text-decoration: none; font-weight: 900; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; padding: 16px 36px; border-radius: 16px;">
                        Restablecer Contraseña
                    </a>
                </div>
                <p style="color: #94a3b8; text-align: center; font-size: 12px; margin: 0;">
                    Este enlace expira en <strong>1 hora</strong>. Si el botón no funciona, copia este enlace en tu navegador:<br>
                    <span style="color: #64748b; word-break: break-all;">${resetUrl}</span>
                </p>
            </div>
        </body>
        </html>
        `,
    });
};
