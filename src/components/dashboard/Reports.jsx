/**
 * Generador de Informes.
 * Visualiza gráficos de tendencias y distribución de gastos mediante Recharts.
 * Permite exportar la vista actual a PDF mediante html-to-image y jsPDF.
 */
import React, { useRef } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, AlertCircle } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { formatCurrency } from '../../utils/formatters';

const COLORS = ['#4f46e5', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#8b5cf6', '#ef4444', '#3b82f6'];

const Reports = ({ transactions, lang, currency, t }) => {
    const reportRef = useRef(null);

    // Process: Expenses by Category
    const expensesByCategory = transactions
        .filter(tx => tx.type === 'expense' && tx.status === 'completed')
        .reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
            return acc;
        }, {});

    const pieExpenseData = Object.keys(expensesByCategory).map(key => ({
        name: t(key),
        value: expensesByCategory[key]
    })).sort((a, b) => b.value - a.value);

    // Process: Income Sources
    const incomesBySource = transactions
        .filter(tx => tx.type === 'income' && tx.status === 'completed')
        .reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
            return acc;
        }, {});

    const pieIncomeData = Object.keys(incomesBySource).map(key => ({
        name: t(key),
        value: incomesBySource[key]
    })).sort((a, b) => b.value - a.value);

    // Process: Trend (Last 6 Months approx, we use YYYY-MM)
    const monthlyDataMap = transactions.reduce((acc, curr) => {
        if (curr.status !== 'completed') return acc;

        const monthKey = curr.date.substring(0, 7); // "YYYY-MM"
        if (!acc[monthKey]) acc[monthKey] = { name: monthKey, incomes: 0, expenses: 0 };

        if (curr.type === 'income') acc[monthKey].incomes += parseFloat(curr.amount);
        else acc[monthKey].expenses += parseFloat(curr.amount);

        return acc;
    }, {});

    const trendData = Object.values(monthlyDataMap)
        .sort((a, b) => a.name.localeCompare(b.name)) // Sort by date ascending
        .slice(-6); // Only last 6 months

    // Formatters for chart tooltips
    const tooltipFormatter = (value) => formatCurrency(value, lang, currency);

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

    if (transactions.filter(tx => tx.status === 'completed').length === 0) {
        return (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 text-center mt-4 shadow-sm">
                <AlertCircle size={40} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700">{t('emptyStateTitle')}</h3>
                <p className="text-sm text-slate-500">{t('emptyStateDesc')}</p>
            </div>
        );
    }

    return (
        <div className="mt-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
                <h2 className="text-xl font-black tracking-tight text-slate-800 ml-4">{t('reports')}</h2>
                <button
                    onClick={downloadPDF}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md font-bold text-sm cursor-pointer"
                >
                    <Download size={16} /> {t('downloadPDF')}
                </button>
            </div>

            <div ref={reportRef} className="bg-slate-50 p-2 sm:p-6 rounded-[2rem]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Expenses Donut */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 h-80">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center">
                            {t('expensesByCategory')}
                        </h3>
                        {pieExpenseData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="85%">
                                <PieChart>
                                    <Pie data={pieExpenseData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={5}>
                                        {pieExpenseData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={tooltipFormatter} />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300">NO DATA</div>
                        )}
                    </div>

                    {/* Incomes Donut */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 h-80">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center">
                            {t('incomeSource')}
                        </h3>
                        {pieIncomeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="85%">
                                <PieChart>
                                    <Pie data={pieIncomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={5}>
                                        {pieIncomeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} stroke="transparent" />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={tooltipFormatter} />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300">NO DATA</div>
                        )}
                    </div>

                    {/* 6 Month Trend Bar Chart */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 h-80 lg:col-span-2">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center">
                            {t('sixMonthTrend')}
                        </h3>
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                                    <RechartsTooltip formatter={tooltipFormatter} cursor={{ fill: '#F8FAFC' }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                                    <Bar dataKey="incomes" name={t('income')} fill="#10B981" radius={[4, 4, 0, 0]} barSize={30} />
                                    <Bar dataKey="expenses" name={t('expense')} fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300">NO DATA</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
