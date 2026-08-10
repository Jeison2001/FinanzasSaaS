/**
 * Tarjeta de Autenticación.
 * Estados: 'login' | 'register' | 'forgot' | 'reset'
 * Gestiona Login, Registro y flujo completo de restablecimiento de contraseña.
 * Todos los strings usan el sistema i18n (es/en/ca).
 */
import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { worldCurrencies } from '../../utils/constants';

// Lee el token de la URL si existe: ?token=xxxx
const getTokenFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
};

const AuthCard = () => {
    const { login } = useAuth();
    const lang = useAppStore((s) => s.lang);
    const t = useTranslation(lang);
    const [view, setView] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [currency, setCurrency] = useState('EUR');
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
            setError(err.response?.data?.error || t('authErrorGeneric'));
        } finally { setLoading(false); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await axiosClient.post('/auth/register', { email: email.toLowerCase(), password, role: 'client', currency });
            login(res.data.token, res.data.role);
        } catch (err) {
            setError(err.response?.data?.error || t('authErrorGeneric'));
        } finally { setLoading(false); }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await axiosClient.post('/auth/forgot-password', { email: email.toLowerCase() });
            setSuccess(t('authForgotSuccess'));
        } catch (err) {
            setError(err.response?.data?.error || t('authErrorGeneric'));
        } finally { setLoading(false); }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) return setError(t('authPasswordMismatch'));
        setError(''); setLoading(true);
        try {
            await axiosClient.post('/auth/reset-password', { token: resetToken, password: newPassword });
            setSuccess(t('authResetSuccess'));
            // Limpia la URL y va al login después de 2s
            setTimeout(() => {
                window.history.replaceState({}, '', '/');
                setView('login');
                setSuccess('');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || t('authErrorGeneric'));
        } finally { setLoading(false); }
    };

    const switchView = (v) => { setView(v); setError(''); setSuccess(''); };

    const titles = {
        login: t('authWelcome'),
        register: t('authCreateAccount'),
        forgot: t('authRecoverPassword'),
        reset: t('authNewPassword'),
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
                        {t('title')}<span className="text-emerald-500">SaaS</span>
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
                        <EmailField label={t('authEmail')} value={email} onChange={setEmail} />
                        <PasswordField label={t('authPassword')} value={password} onChange={setPassword} />
                        <div className="text-right">
                            <button type="button" onClick={() => switchView('forgot')}
                                className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer">
                                {t('authForgotLink')}
                            </button>
                        </div>
                        <SubmitButton loading={loading} label={t('authLogin')} />
                        <SwitchButton onClick={() => switchView('register')} label={t('authSwitchToRegister')} />
                    </form>
                )}

                {/* REGISTER */}
                {view === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <EmailField label={t('authEmail')} value={email} onChange={setEmail} />
                        <PasswordField label={t('authPassword')} value={password} onChange={setPassword} />
                        <CurrencyField value={currency} onChange={setCurrency} t={t} />
                        <SubmitButton loading={loading} label={t('authRegister')} />
                        <SwitchButton onClick={() => switchView('login')} label={t('authSwitchToLogin')} />
                    </form>
                )}

                {/* FORGOT */}
                {view === 'forgot' && !success && (
                    <form onSubmit={handleForgot} className="space-y-4">
                        <p className="text-sm text-slate-400 font-medium text-center mb-2">
                            {t('authForgotDesc')}
                        </p>
                        <EmailField label={t('authEmail')} value={email} onChange={setEmail} />
                        <SubmitButton loading={loading} label={t('authSendLink')} />
                        <SwitchButton onClick={() => switchView('login')} label={t('authBackToLogin')} />
                    </form>
                )}
                {view === 'forgot' && success && (
                    <SwitchButton onClick={() => switchView('login')} label={t('authBackToLogin')} />
                )}

                {/* RESET */}
                {view === 'reset' && !success && (
                    <form onSubmit={handleReset} className="space-y-4">
                        <PasswordField label={t('authNewPassword')} value={newPassword} onChange={setNewPassword} />
                        <PasswordField label={t('authConfirmPassword')} value={confirmPassword} onChange={setConfirmPassword} />
                        <SubmitButton loading={loading} label={t('authSavePassword')} />
                    </form>
                )}
            </div>
        </div>
    );
};

// ─── Sub-componentes reutilizables ────────────────────────────────────────────

const inputCls = "w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium";
const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1";

const EmailField = ({ label, value, onChange }) => (
    <div className="space-y-1">
        <label className={labelCls}>{label}</label>
        <input type="email" required className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
);

const PasswordField = ({ label, value, onChange }) => (
    <div className="space-y-1">
        <label className={labelCls}>{label}</label>
        <input type="password" required minLength={6} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
);

const CurrencyField = ({ value, onChange, t }) => (
    <div className="space-y-1">
        <label className={labelCls}>{t('currency')}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold cursor-pointer hover:bg-slate-100 transition-colors"
        >
            {worldCurrencies.map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
        </select>
        <p className="text-[10px] text-slate-400 font-medium ml-1">{t('currencyFixed')}</p>
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
