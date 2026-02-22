import React from 'react';
import { Search, Filter, X, PieChart } from 'lucide-react';
import { months, years } from '../../utils/constants';

const TransactionFilters = ({
    filters,
    setters,
    showFilters,
    setShowFilters,
    clearAllFilters,
    lang,
    t
}) => {
    const { filterType, searchQuery, filterMonth, filterYear, startDate, endDate } = filters;
    const { setFilterType, setSearchQuery, setFilterMonth, setFilterYear, setStartDate, setEndDate } = setters;

    return (
        <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tighter">
                    <PieChart size={20} className="text-slate-950" />
                    {t('history')}
                </h2>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder')}
                            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs w-40 md:w-56 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${showFilters ? 'bg-slate-950 border-slate-950 text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Filter size={16} />
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <option value="all">{t('all')}</option>
                        <option value="income">{t('income')}</option>
                        <option value="expense">{t('expense')}</option>
                    </select>

                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
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
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <option value="">{t('filterYear')}</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none"
                        placeholder={t('startDate')}
                    />

                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none"
                        placeholder={t('endDate')}
                    />

                    <button
                        onClick={clearAllFilters}
                        className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all duration-200 cursor-pointer shadow-sm"
                    >
                        <X size={12} strokeWidth={3} /> {t('clearFilters')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TransactionFilters;
