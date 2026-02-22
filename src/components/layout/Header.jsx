import React from 'react';
import { BarChart3, PlusCircle, LogOut, Shield } from 'lucide-react';
import { worldCurrencies } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';

const Header = ({ lang, setLang, currency, setCurrency, setShowAddModal, role, setForceClientView, saveSettings, t }) => {
    const { logout } = useAuth();
    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-950 p-2 rounded-lg text-emerald-400">
                        <BarChart3 size={20} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                        {t('title')} <span className="text-emerald-500">SaaS</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-2 mr-2">
                        <select
                            value={lang}
                            onChange={(e) => { setLang(e.target.value); saveSettings({ language: e.target.value }); }}
                            className="bg-slate-50 text-[10px] font-black p-1 rounded border border-slate-200 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <option value="es">ES</option>
                            <option value="en">EN</option>
                            <option value="ca">CA</option>
                        </select>
                        <select
                            value={currency}
                            onChange={(e) => { setCurrency(e.target.value); saveSettings({ currency: e.target.value }); }}
                            className="bg-slate-50 text-[10px] font-black p-1 rounded border border-slate-200 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            {worldCurrencies.map(c => (
                                <option key={c.code} value={c.code}>{c.code}</option>
                            ))}
                        </select>
                    </div>

                    {role === 'admin' && (
                        <button
                            onClick={() => setForceClientView(false)}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md font-bold text-sm cursor-pointer"
                        >
                            <Shield size={16} />
                            <span className="hidden sm:inline">{t('adminPanel')}</span>
                        </button>
                    )}

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md font-bold text-sm cursor-pointer"
                    >
                        <PlusCircle size={18} />
                        <span className="hidden sm:inline">{t('newTransaction')}</span>
                    </button>
                    <button
                        onClick={logout}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-600 px-3 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm font-bold text-sm ml-2 cursor-pointer"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
