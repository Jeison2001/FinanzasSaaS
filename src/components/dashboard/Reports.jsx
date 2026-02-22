/**
 * Generador de Informes.
 * Visualiza gráficos de tendencias y distribución de gastos mediante Recharts.
 * Permite exportar la vista actual a PDF mediante html-to-image y jsPDF.
 */
import React, { useRef, useState } from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Download, AlertCircle, TrendingUp, TrendingDown, Wallet, X, Search } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { formatCurrency } from '../../utils/formatters';
import { useReports } from '../../hooks/useReports';
import { months, years } from '../../utils/constants';

const COLORS = ['#4f46e5', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#8b5cf6', '#ef4444', '#3b82f6'];

const Reports = ({ refreshTrigger, lang, currency, t }) => {
    const reportRef = useRef(null);
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [appliedFilters, setAppliedFilters] = useState({ month: '', year: '', start: '', end: '' });

    const { reportsData, loading } = useReports(
        refreshTrigger,
        appliedFilters.month,
        appliedFilters.year,
        appliedFilters.start,
        appliedFilters.end
    );
    const { expensesByCategory, incomesBySource, trendData } = reportsData;

    const applyFilters = () => {
        setAppliedFilters({ month: filterMonth, year: filterYear, start: startDate, end: endDate });
    };

    const clearFilters = () => {
        setFilterMonth('');
        setFilterYear('');
        setStartDate('');
        setEndDate('');
        setAppliedFilters({ month: '', year: '', start: '', end: '' });
    };

    // Calculo totales para porcentajes
    const totalExpensesCalc = Object.values(expensesByCategory).reduce((acc, val) => acc + val, 0);
    const totalIncomesCalc = Object.values(incomesBySource).reduce((acc, val) => acc + val, 0);

    // Process: Expenses by Category
    const pieExpenseData = Object.keys(expensesByCategory).map(key => ({
        name: t(key),
        value: expensesByCategory[key],
        total: totalExpensesCalc
    })).sort((a, b) => b.value - a.value);

    // Process: Income Sources
    const pieIncomeData = Object.keys(incomesBySource).map(key => ({
        name: t(key),
        value: incomesBySource[key],
        total: totalIncomesCalc
    })).sort((a, b) => b.value - a.value);

    // Summary Metrics & Enhanced Trend Data
    const totalMonths = trendData.length;
    const totalTrendIncomes = trendData.reduce((acc, curr) => acc + curr.incomes, 0);
    const totalTrendExpenses = trendData.reduce((acc, curr) => acc + curr.expenses, 0);
    const avgIncome = totalMonths > 0 ? totalTrendIncomes / totalMonths : 0;
    const avgExpense = totalMonths > 0 ? totalTrendExpenses / totalMonths : 0;
    const savingsRate = totalTrendIncomes > 0 ? ((totalTrendIncomes - totalTrendExpenses) / totalTrendIncomes) * 100 : 0;

    const enhancedTrendData = trendData.map(item => ({
        ...item,
        netBalance: item.incomes - item.expenses
    }));

    const CustomTrendTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl min-w-[160px]">
                    <p className="text-white font-bold text-sm mb-3 border-b border-slate-700 pb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex justify-between items-center mt-2 text-xs">
                            <span style={{ color: entry.color || entry.stroke || entry.fill }} className="font-bold">{entry.name}:</span>
                            <span className="text-slate-300 font-medium ml-4">{formatCurrency(entry.value, lang, currency)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const downloadPDF = async () => {
        if (!reportRef.current) return;
        try {
            const dataUrl = await toPng(reportRef.current, {
                scale: 2,
                backgroundColor: '#f8fafc',
                cacheBust: true,
            });

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            const img = new Image();
            img.src = dataUrl;
            await new Promise((resolve) => { img.onload = resolve; });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (img.height * pdfWidth) / img.width;

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

            // Metadatos para profesionalismo (se ven en propiedades del archivo)
            pdf.setProperties({
                title: 'Reporte de Transacciones - FinanzasSaaS',
                subject: 'Reporte Financiero',
                author: 'FinanzasSaaS',
                creator: 'FinanzasSaaS System'
            });

            // Método estándar de oro para producción
            pdf.save('FinanzasSaaS_Report.pdf');

        } catch (error) {
            console.error('[Reports] Error al generar reporte PDF:', error);
            alert('Error al generar el PDF.');
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 text-center mt-4 shadow-sm flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
            </div>
        );
    }

    const filtersActive = !!(appliedFilters.month !== '' || appliedFilters.year || appliedFilters.start || appliedFilters.end);
    const hasData = pieExpenseData.length > 0 || pieIncomeData.length > 0 || trendData.length > 0;

    return (
        <div className="mt-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm gap-4">
                <h2 className="text-xl font-black tracking-tight text-slate-800 md:ml-4">{t('reports')}</h2>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <select
                        value={filterMonth}
                        onChange={(e) => { setFilterMonth(e.target.value); setStartDate(''); setEndDate(''); }}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <option value="">{t('filterMonth')}</option>
                        {months.map(m => (
                            <option key={m} value={m}>
                                {new Date(2024, m).toLocaleString(lang === 'en' ? 'en-US' : (lang === 'ca' ? 'ca-ES' : 'es-ES'), { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filterYear}
                        onChange={(e) => { setFilterYear(e.target.value); setStartDate(''); setEndDate(''); }}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <option value="">{t('filterYear')}</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setFilterMonth(''); setFilterYear(''); }}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none"
                        title={t('startDate') || 'Start Date'}
                    />
                    <span className="text-slate-300 text-xs">-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setFilterMonth(''); setFilterYear(''); }}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none"
                        title={t('endDate') || 'End Date'}
                    />

                    <button
                        onClick={applyFilters}
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors cursor-pointer"
                        title={t('searchPlaceholder') || 'Apply Filters'}
                    >
                        <Search size={16} strokeWidth={2.5} />
                    </button>

                    {(filterMonth || filterYear || startDate || endDate) && (
                        <button onClick={clearFilters} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer" title={t('clearFilters') || 'Clear Filters'}>
                            <X size={16} strokeWidth={3} />
                        </button>
                    )}

                    <button
                        onClick={downloadPDF}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 md:ml-2 rounded-xl flex items-center gap-2 transition-all shadow-md font-bold text-sm cursor-pointer"
                    >
                        <Download size={16} /> <span className="hidden sm:inline">{t('downloadPDF')}</span>
                    </button>
                </div>
            </div>


            <div ref={reportRef} className="rounded-[2rem]">
                {hasData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Expenses Horizontal Bars */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">
                                {t('expensesByCategory')}
                            </h3>
                            {pieExpenseData.length > 0 ? (
                                <div className="space-y-4">
                                    {pieExpenseData.map((item, index) => {
                                        const percentage = item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : 0;
                                        const color = COLORS[index % COLORS.length];
                                        return (
                                            <div key={index} className="space-y-1">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-bold text-slate-700">{item.name}</span>
                                                    <span className="font-bold text-slate-900">{formatCurrency(item.value, lang, currency)}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 min-w-8 text-right">{percentage}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-10 flex items-center justify-center text-xs font-bold text-slate-300">{t('noData')}</div>
                            )}
                        </div>

                        {/* Incomes Horizontal Bars */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">
                                {t('incomeSource')}
                            </h3>
                            {pieIncomeData.length > 0 ? (
                                <div className="space-y-4">
                                    {pieIncomeData.map((item, index) => {
                                        const percentage = item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : 0;
                                        const color = COLORS[(index + 4) % COLORS.length];
                                        return (
                                            <div key={index} className="space-y-1">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-bold text-slate-700">{item.name}</span>
                                                    <span className="font-bold text-slate-900">{formatCurrency(item.value, lang, currency)}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 min-w-8 text-right">{percentage}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-10 flex items-center justify-center text-xs font-bold text-slate-300">{t('noData')}</div>
                            )}
                        </div>

                        {/* 6 Month Trend Composed Chart */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 h-96 lg:col-span-2">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center">
                                {filtersActive ? t('trendTitleFiltered') : t('trendTitle')}
                            </h3>
                            {enhancedTrendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="85%">
                                    <ComposedChart data={enhancedTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                                        <RechartsTooltip content={<CustomTrendTooltip />} cursor={{ fill: '#F8FAFC' }} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                                        <Bar dataKey="incomes" name={t('income')} fill="#10B981" radius={[4, 4, 0, 0]} barSize={30} />
                                        <Bar dataKey="expenses" name={t('expense')} fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={30} />
                                        <Line type="monotone" dataKey="netBalance" name={t('netBalance')} stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300">{t('noData')}</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-[2rem] border border-slate-200 p-16 text-center shadow-sm flex flex-col items-center justify-center">
                        <AlertCircle size={64} className="text-slate-200 mb-6" />
                        {filtersActive ? (
                            <>
                                <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-2">{t('noResultsTitle')}</h3>
                                <p className="text-sm font-semibold text-slate-300 max-w-md mx-auto">{t('noResultsDesc')}</p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-2">{t('emptyStateTitle')}</h3>
                                <p className="text-sm font-semibold text-slate-300 max-w-md mx-auto">{t('emptyStateDesc')}</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
