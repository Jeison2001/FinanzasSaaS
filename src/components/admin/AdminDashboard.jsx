/**
 * Dashboard de Administración.
 * Permite gestionar usuarios, ver estadísticas de registro y cambiar entre vistas.
 * Acceso restringido a usuarios con rol 'admin'.
 */
import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Users, Shield, LayoutDashboard, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../locales';

const AdminDashboard = ({ lang, setLang, setForceClientView }) => {
    const { token, logout } = useAuth();
    const [users, setUsers] = useState([]);
    const t = useTranslation(lang);

    const fetchUsers = async () => {
        try {
            const res = await axiosClient.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            console.error('[AdminDashboard] Error al cargar usuarios:', err);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [token]);

    const handleReset = async (user) => {
        const confirmMsg = t('resetConfirm') || `¿Estás seguro de que deseas limpiar toda la información de este usuario? Esta acción es irreversible.`;
        if (window.confirm(confirmMsg)) {
            try {
                await axiosClient.post(`/admin/users/${user.id}/reset`);
                alert(t('dataResetSuccess') || 'Información del usuario reseteada con éxito.');
                fetchUsers();
            } catch (err) {
                console.error('[AdminDashboard] Error al resetear usuario:', err);
                alert('Error al resetear la información del usuario.');
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
            <header className="bg-slate-900 border-b border-emerald-500/20 sticky top-0 z-30 shadow-sm text-white">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="text-emerald-400" size={24} />
                        <h1 className="text-xl font-bold tracking-tight">
                            {t('adminPanel')}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={lang}
                            onChange={(e) => setLang(e.target.value)}
                            className="bg-slate-800 text-slate-300 text-[10px] font-black p-1.5 rounded-lg border border-slate-700 uppercase tracking-widest cursor-pointer hover:bg-slate-700 transition-colors mr-2 outline-none"
                        >
                            <option value="es">ES</option>
                            <option value="en">EN</option>
                            <option value="ca">CA</option>
                        </select>
                        <button
                            onClick={() => setForceClientView(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm font-bold text-sm cursor-pointer"
                        >
                            <LayoutDashboard size={16} /> <span className="hidden sm:inline">{t('viewClientDashboard')}</span>
                        </button>
                        <button
                            onClick={logout}
                            className="bg-slate-800 hover:bg-slate-700 text-rose-400 px-3 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm font-bold text-sm cursor-pointer"
                        >
                            <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 mt-6">
                <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Users className="text-emerald-600" size={24} />
                        <h2 className="text-2xl font-black text-slate-800 tracking-tighter">
                            {t('registeredClients')}
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left bg-slate-50/50 rounded-2xl overflow-hidden">
                            <thead>
                                <tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <th className="px-6 py-4">{t('clientEmail')}</th>
                                    <th className="px-6 py-4">{t('role') || 'Rol'}</th>
                                    <th className="px-6 py-4">{t('registrationDate')}</th>
                                    <th className="px-6 py-4">{t('lastLogin')}</th>
                                    <th className="px-6 py-4">{t('totalTransactions')}</th>
                                    <th className="px-6 py-4 text-right">{t('actions') || 'Acciones'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-white transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700">{user.email}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                user.role === 'admin' 
                                                    ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {user.last_login_at ? new Date(user.last_login_at).toLocaleString(lang) : t('never')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                                                {user.transaction_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleReset(user)}
                                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 p-2 rounded-xl transition-all border border-amber-200 cursor-pointer inline-flex items-center gap-1.5 font-bold text-xs"
                                                title={t('resetData') || 'Resetear Datos'}
                                            >
                                                <RefreshCw size={14} />
                                                <span>{t('resetData') || 'Reset'}</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-slate-400 font-medium">
                                            {t('noClients')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
