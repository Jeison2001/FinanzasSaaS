import React from 'react';
import { Target, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDateI18n } from '../../utils/formatters';

const Sidebar = ({ stats, savingsGoal, transactions, lang, currency, setShowGoalModal, t }) => {
    return (
        <div className="space-y-6">
            {/* SAVINGS GOAL */}
            <div className="bg-slate-950 text-white p-7 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-lg tracking-tight">{t('savingGoal')}</h3>
                        <Target size={24} className="text-emerald-400 opacity-50 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-slate-300 text-xs mb-6 font-medium leading-relaxed">
                        {t('savingGoalText')
                            .replace('{goal}', formatCurrency(savingsGoal, lang, currency))
                            .replace('{percent}', stats.goalPercent)}
                    </p>

                    <div className="w-full bg-slate-800/80 rounded-full h-4 mb-8 p-1 backdrop-blur-sm">
                        <div
                            className="bg-gradient-to-r from-emerald-500 to-emerald-300 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                            style={{ width: `${stats.goalPercent}%` }}
                        ></div>
                    </div>

                    <button
                        onClick={() => setShowGoalModal(true)}
                        className="w-full bg-white/10 hover:bg-white text-white hover:text-slate-950 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 backdrop-blur-md cursor-pointer hover:shadow-lg"
                    >
                        {t('viewDetails')}
                    </button>
                </div>
                <div className="absolute -right-10 -bottom-10 bg-emerald-500/20 rounded-full w-48 h-48 blur-2xl"></div>
            </div>

            {/* UPCOMING */}
            <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 tracking-tighter uppercase text-xs">
                    <ChevronRight size={16} className="text-slate-950" />
                    {t('upcoming')}
                </h3>
                <div className="space-y-3">
                    {transactions
                        .filter(it => it.status === 'planned')
                        .slice(0, 3)
                        .map(pt => (
                            <div key={pt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 hover:border-slate-400 transition-colors">
                                <div>
                                    <p className="text-xs font-black text-slate-700 uppercase tracking-tighter mb-1">
                                        {pt.description}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                        {formatDateI18n(pt.date, lang)}
                                    </p>
                                </div>
                                <p className={`text-xs font-black ${pt.type === 'income' ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {pt.type === 'income' ? '+' : '-'}{formatCurrency(pt.amount, lang, currency)}
                                </p>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
