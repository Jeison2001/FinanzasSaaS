/**
 * Tarjeta de Autenticación.
 * Gestiona el Login y Registro de usuarios y administradores.
 */
import React, { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../hooks/useAuth';

const AuthCard = () => {
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const normalizedEmail = email.toLowerCase();

        try {
            const res = await axiosClient.post(endpoint, {
                email: normalizedEmail,
                password,
                role: 'client' // Solo se permite registrar clientes desde el front
            });
            login(res.data.token, res.data.role);
        } catch (err) {
            console.error('[AuthCard] Fallo en la autenticación:', err);
            setError(err.response?.data?.error || 'Authentication failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full p-8 rounded-[2rem] shadow-xl">
                <h1 className="text-3xl font-black text-slate-800 text-center tracking-tighter mb-8">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h1>

                {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm font-bold text-center mb-6">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-emerald-100 mt-6 transition-all cursor-pointer">
                        {isLogin ? 'Log In' : 'Sign Up'}
                    </button>

                    <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-slate-400 hover:text-emerald-600 text-xs font-bold pt-4 text-center cursor-pointer">
                        {isLogin ? 'Need an account? Sign up' : 'Already have an account? Log in'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AuthCard;
