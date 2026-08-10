/**
 * Panel de Presupuestos Mensuales.
 * Define límites por categoría y compara contra el gasto real del período
 * (completado + vencido, excluye planificadas). Alerta visual al superar
 * el 80% (ámbar) y el 100% (rojo).
 */
import React, { useState, useEffect } from 'react';
import { PiggyBank, AlertTriangle, Check } from 'lucide-react';
import { useBudgets } from '../../hooks/useBudgets';
import { useReports } from '../../hooks/useReports';
import { months, years, categories } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

const BudgetsPanel = ({ lang, currency, t }) => {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [draft, setDraft] = useState({}); // category -> string (valor editable)
    const [savedMsg, setSavedMsg] = useState(false);

    const { budgets, loading: budgetsLoading, saveBudgets } = useBudgets(month, year);
    const { reportsData } = useReports(0, String(month), String(year), '', '');
    const spentByCategory = reportsData.expensesByCategory || {};

    // Sincronizar el borrador cuando se cargan los presupuestos del período
    useEffect(() => {
        const d = {};
        budgets.forEach(b => { d[b.category] = String(b.amount); });
        setDraft(d);
    }, [budgets]);

    // Solo categorías de gasto: las que tienen presupuesto o gasto real
    const rows = categories.expense
        .map(cat => {
            const budget = parseFloat(draft[cat]) || 0;
            const spent = spentByCategory[cat] || 0;
            return { cat, budget, spent, hasActivity: budget > 0 || spent > 0 };
        })
        .filter(r => r.hasActivity)
        .sort((a, b) => (b.spent - a.spent) || (b.budget - a.budget));

    const totalBudget = rows.reduce((acc, r) => acc + r.budget, 0);
    const totalSpent = rows.reduce((acc, r) => acc + r.spent, 0);

    const handleSave = async () => {
        const items = Object.entries(draft)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([category, amount]) => ({ category, amount: parseFloat(amount) }));
        const res = await saveBudgets(items);
        if (res.ok) {
            setSavedMsg(true);
            setTimeout(() => setSavedMsg(false), 2500);
        }
    };

    return (
        <div className="mt-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm gap-4">
                <h2 className="text-xl font-black tracking-tight text-slate-800 md:ml-4 flex items-center gap-2">
                    <PiggyBank size={22} className="text-emerald-500" />
                    {t('budgets')}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        {months.map(m => (
                            <option key={m} value={m}>
                                {new Date(2024, m).toLocaleString(lang === 'en' ? 'en-US' : (lang === 'ca' ? 'ca-ES' : 'es-ES'), { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button
                        onClick={handleSave}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md font-bold text-sm cursor-pointer"
                    >
                        {savedMsg ? <Check size={16} className="text-emerald-400" /> : null}
                        <span>{savedMsg ? t('budgetSaved') : t('saveBudgets')}</span>
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{t('budgetDesc')}</p>

                {budgetsLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-10 text-xs font-bold text-slate-300">{t('noBudgetSet')}</div>
                ) : (
                    <div className="space-y-5">
                        {rows.map(({ cat, budget, spent }) => {
                            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                            const pctDisplay = budget > 0 ? ((spent / budget) * 100).toFixed(0) : '—';
                            const exceeded = budget > 0 && spent >= budget;
                            const close = budget > 0 && !exceeded && spent >= budget * 0.8;
                            const barColor = exceeded ? 'bg-rose-500' : close ? 'bg-amber-400' : 'bg-emerald-500';

                            return (
                                <div key={cat} className="space-y-2">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-black text-slate-700 truncate">{t(cat)}</span>
                                            {exceeded && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                    <AlertTriangle size={10} /> {t('budgetExceeded')}
                                                </span>
                                            )}
                                            {close && !exceeded && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                    {t('budgetAlmost')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-xs font-black text-slate-900">
                                                {formatCurrency(spent, lang, currency)}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {' / '}{formatCurrency(budget, lang, currency)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 min-w-8 text-right">{pctDisplay}%</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder={t('noBudgetSet')}
                                        value={draft[cat] !== undefined ? draft[cat] : ''}
                                        onChange={(e) => setDraft(prev => ({ ...prev, [cat]: e.target.value }))}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {rows.length > 0 && (
                <div className="bg-slate-950 text-white p-6 rounded-[2rem] shadow-xl">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('budgetTotal')}</p>
                            <p className="text-2xl font-black">{formatCurrency(totalBudget, lang, currency)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('budgetSpent')}</p>
                            <p className={`text-2xl font-black ${totalSpent > totalBudget ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {formatCurrency(totalSpent, lang, currency)}
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 w-full bg-slate-800/80 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${totalBudget > 0 && totalSpent >= totalBudget ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-300'}`}
                            style={{ width: `${totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}%` }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetsPanel;
