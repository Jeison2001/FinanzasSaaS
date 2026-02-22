import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const KPICards = ({ stats, lang, currency, t }) => {
    // Calculate net savings
    const netSavings = stats.plannedIncome - stats.plannedExpense;

    return (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
            <div className="bg-white p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-1 md:mb-2">
                    <div className="p-1.5 md:p-2 bg-slate-950 text-white rounded-lg">
                        <Wallet size={14} className="md:hidden" />
                        <Wallet size={20} className="hidden md:block" />
                    </div>
                    <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('actualBalance')}
                    </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:hidden">{t('actualBalance')}</p>
                <p className="text-sm md:text-2xl font-black text-slate-800 tracking-tight leading-none">
                    {formatCurrency(stats.actualBalance, lang, currency)}
                </p>
            </div>

            <div className="bg-white p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-1 md:mb-2">
                    <div className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <TrendingUp size={14} className="md:hidden" />
                        <TrendingUp size={20} className="hidden md:block" />
                    </div>
                    <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('plannedIncome')}
                    </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:hidden">{t('plannedIncome')}</p>
                <p className="text-sm md:text-2xl font-black text-slate-800 tracking-tight leading-none">
                    {formatCurrency(stats.plannedIncome, lang, currency)}
                </p>
            </div>

            <div className="bg-white p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-1 md:mb-2">
                    <div className="p-1.5 md:p-2 bg-rose-50 text-rose-600 rounded-lg">
                        <TrendingDown size={14} className="md:hidden" />
                        <TrendingDown size={20} className="hidden md:block" />
                    </div>
                    <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('plannedExpense')}
                    </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:hidden">{t('plannedExpense')}</p>
                <p className="text-sm md:text-2xl font-black text-slate-800 tracking-tight leading-none">
                    {formatCurrency(stats.plannedExpense, lang, currency)}
                </p>
            </div>

            {/* Net Savings Card */}
            <div className="bg-slate-900 border border-slate-800 p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-1 md:mb-2">
                    <div className="p-1.5 md:p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                        <Sparkles size={14} className="md:hidden" />
                        <Sparkles size={20} className="hidden md:block" />
                    </div>
                    <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('netBalance')}
                    </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:hidden">{t('netBalance')}</p>
                <p className={`text-sm md:text-2xl font-black tracking-tight leading-none ${netSavings >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    {formatCurrency(netSavings, lang, currency)}
                </p>
            </div>
        </section>
    );
};

export default KPICards;
