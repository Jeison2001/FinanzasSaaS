/**
 * Tarjeta de Autenticación.
 * Estados: 'login' | 'register' | 'forgot' | 'reset'
 * Gestiona Login, Registro y flujo completo de restablecimiento de contraseña.
 */
import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../hooks/useAuth';

// Lee el token de la URL si existe: ?token=xxxx
const getTokenFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
};

const AuthCard = () => {
    const { login } = useAuth();
    const [view, setView] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    // Si hay token en la URL, ir directamente al formulario de reset
    useEffect(() => {
        const token = getTokenFromUrl();
        if (token) {
            setResetToken(token);
            setView('reset');
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await axiosClient.post('/auth/login', { email: email.toLowerCase(), password });
            login(res.data.token, res.data.role);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        } finally { setLoading(false); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await axiosClient.post('/auth/register', { email: email.toLowerCase(), password, role: 'client' });
            login(res.data.token, res.data.role);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrarse');
        } finally { setLoading(false); }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await axiosClient.post('/auth/forgot-password', { email: email.toLowerCase() });
            setSuccess('Si el email existe recibirás las instrucciones. Revisa también tu carpeta de spam.');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al enviar el email');
        } finally { setLoading(false); }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) return setError('Las contraseñas no coinciden');
        setError(''); setLoading(true);
        try {
            await axiosClient.post('/auth/reset-password', { token: resetToken, password: newPassword });
            setSuccess('¡Contraseña actualizada! Ya puedes iniciar sesión.');
            // Limpia la URL y va al login después de 2s
            setTimeout(() => {
                window.history.replaceState({}, '', '/');
                setView('login');
                setSuccess('');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al restablecer la contraseña');
        } finally { setLoading(false); }
    };

    const switchView = (v) => { setView(v); setError(''); setSuccess(''); };

    const titles = {
        login: 'Bienvenido',
        register: 'Crear Cuenta',
        forgot: 'Recuperar Contraseña',
        reset: 'Nueva Contraseña',
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full p-8 rounded-[2rem] shadow-xl">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="bg-slate-950 p-2 rounded-xl">
                        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                            <rect x="8" y="8" width="4" height="16" rx="1" fill="#10b981" />
                            <rect x="8" y="8" width="16" height="4" rx="1" fill="#10b981" />
                            <rect x="8" y="14" width="12" height="4" rx="1" fill="#10b981" />
                        </svg>
                    </div>
                    <span className="text-xl font-black text-slate-800 tracking-tight">
                        Finanza<span className="text-emerald-500">SaaS</span>
                    </span>
                </div>

                <h1 className="text-2xl font-black text-slate-800 text-center tracking-tighter mb-6">
                    {titles[view]}
                </h1>

                {error && (
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm font-bold text-center mb-4">{error}</div>
                )}
                {success && (
                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm font-bold text-center mb-4">{success}</div>
                )}

                {/* LOGIN */}
                {view === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <EmailField value={email} onChange={setEmail} />
                        <PasswordField label="Contraseña" value={password} onChange={setPassword} />
                        <div className="text-right">
                            <button type="button" onClick={() => switchView('forgot')}
                                className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer">
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
                        <SubmitButton loading={loading} label="Iniciar Sesión" />
                        <SwitchButton onClick={() => switchView('register')} label="¿No tienes cuenta? Regístrate" />
                    </form>
                )}

                {/* REGISTER */}
                {view === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <EmailField value={email} onChange={setEmail} />
                        <PasswordField label="Contraseña" value={password} onChange={setPassword} />
                        <SubmitButton loading={loading} label="Crear Cuenta" />
                        <SwitchButton onClick={() => switchView('login')} label="¿Ya tienes cuenta? Inicia sesión" />
                    </form>
                )}

                {/* FORGOT */}
                {view === 'forgot' && !success && (
                    <form onSubmit={handleForgot} className="space-y-4">
                        <p className="text-sm text-slate-400 font-medium text-center mb-2">
                            Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                        </p>
                        <EmailField value={email} onChange={setEmail} />
                        <SubmitButton loading={loading} label="Enviar enlace" />
                        <SwitchButton onClick={() => switchView('login')} label="← Volver al login" />
                    </form>
                )}
                {view === 'forgot' && success && (
                    <SwitchButton onClick={() => switchView('login')} label="← Volver al login" />
                )}

                {/* RESET */}
                {view === 'reset' && !success && (
                    <form onSubmit={handleReset} className="space-y-4">
                        <PasswordField label="Nueva Contraseña" value={newPassword} onChange={setNewPassword} />
                        <PasswordField label="Confirmar Contraseña" value={confirmPassword} onChange={setConfirmPassword} />
                        <SubmitButton loading={loading} label="Guardar Contraseña" />
                    </form>
                )}
            </div>
        </div>
    );
};

// ─── Sub-componentes reutilizables ────────────────────────────────────────────

const inputCls = "w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium";
const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1";

const EmailField = ({ value, onChange }) => (
    <div className="space-y-1">
        <label className={labelCls}>Email</label>
        <input type="email" required className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
);

const PasswordField = ({ label, value, onChange }) => (
    <div className="space-y-1">
        <label className={labelCls}>{label}</label>
        <input type="password" required minLength={6} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
);

const SubmitButton = ({ loading, label }) => (
    <button type="submit" disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-emerald-100 mt-2 transition-all cursor-pointer">
        {loading ? '...' : label}
    </button>
);

const SwitchButton = ({ onClick, label }) => (
    <button type="button" onClick={onClick}
        className="w-full text-slate-400 hover:text-emerald-600 text-xs font-bold pt-2 text-center cursor-pointer transition-colors">
        {label}
    </button>
);

export default AuthCard;
