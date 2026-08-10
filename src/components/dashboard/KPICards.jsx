import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Sparkles, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const periodOptions = [
    { value: 'month', key: 'periodMonth' },
    { value: 'year', key: 'periodYear' },
    { value: 'all', key: 'periodAll' }
];

const KPICards = ({ stats, lang, currency, t, period, onPeriodChange }) => {
    // Calculate net savings
    const netSavings = stats.plannedIncome - stats.plannedExpense;
    const hasOverdue = stats.overdueExpense > 0;

    return (
        <section className="space-y-3">
            {/* Alerta de pagos vencidos sin confirmar */}
            {hasOverdue && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <p className="text-sm font-bold text-amber-800">
                        {t('overdueWarning').replace('{amount}', formatCurrency(stats.overdueExpense, lang, currency))}
                    </p>
                </div>
            )}

            {/* Selector de período */}
            <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200 w-full sm:w-fit">
                {periodOptions.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => onPeriodChange(opt.value)}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                            period === opt.value ? 'bg-slate-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {t(opt.key)}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
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
            </div>
        </section>
    );
};

export default KPICards;
