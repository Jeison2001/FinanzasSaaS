/**
 * Tabla de Transacciones Principal.
 * Implementa vista responsiva (Cards en móvil, Tabla en desktop).
 * Soporta edición, eliminación y visualización de estados (Confirmado/Pendiente).
 */
import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatCurrency, formatDateI18n } from '../../utils/formatters';
import EmptyState from './EmptyState';

const StatusBadge = ({ status, t }) => (
    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border whitespace-nowrap ${status === 'completed'
        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
        : 'bg-orange-50 text-orange-600 border-orange-100'
        }`}>
        {status === 'completed' ? t('confirmed') : t('pending')}
    </span>
);

const TransactionTable = ({
    transactions,
    totalTransactionsCount,
    setShowAddModal,
    onEdit,
    deleteTransaction,
    loadMore,
    hasMore,
    loading,
    lang,
    currency,
    t
}) => {
    if (totalTransactionsCount === 0) {
        return <EmptyState setShowAddModal={setShowAddModal} t={t} />;
    }

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">

            {/* ── MOBILE: card list ── */}
            <div className="md:hidden divide-y divide-slate-100">
                {transactions.map((item) => (
                    <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3 group hover:bg-slate-50 transition-colors ${item.status === 'planned' ? 'opacity-60' : ''
                            }`}
                    >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.type === 'income' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`} />

                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(item)}>
                            <p className="text-sm font-bold text-slate-800 truncate">
                                {item.description}
                                {!!item.is_modified && <span className="ml-1 text-amber-500 text-[9px]">✎</span>}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold">
                                {formatDateI18n(item.date, lang)} · {t(item.category)}
                            </p>
                        </div>

                        <div className="text-right shrink-0">
                            <p className={`text-sm font-black ${item.type === 'income' ? 'text-emerald-600' : 'text-slate-700'
                                }`}>
                                {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, lang, currency)}
                            </p>
                            <StatusBadge status={item.status} t={t} />
                        </div>

                        <button
                            onClick={() => deleteTransaction(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all cursor-pointer shrink-0"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}

                {transactions.length === 0 && (
                    <p className="px-4 py-10 text-center text-slate-400 font-medium text-sm">
                        {t('noTransactions')}
                    </p>
                )}

                {hasMore && transactions.length > 0 && (
                    <div className="p-4 text-center">
                        <button
                            onClick={loadMore}
                            disabled={loading}
                            className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? t('loading') || 'Loading...' : t('loadMore') || 'Load More'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── DESKTOP: classic table ── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4">{t('date')}</th>
                            <th className="px-6 py-4">{t('description')}</th>
                            <th className="px-6 py-4">{t('amount')}</th>
                            <th className="px-6 py-4">{t('status')}</th>
                            <th className="px-6 py-4 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {transactions.map((item) => (
                            <tr key={item.id} className={`group hover:bg-slate-50 transition-colors ${item.status === 'planned' ? 'opacity-60 italic' : ''
                                }`}>
                                <td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                                    {formatDateI18n(item.date, lang)}
                                    {!!item.is_modified && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[8px] font-black uppercase" title="Modificado">
                                            *
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-800 leading-none mb-1 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => onEdit(item)}>
                                        {item.description}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                                        {t(item.category)}
                                    </p>
                                </td>
                                <td className={`px-6 py-4 text-sm font-black ${item.type === 'income' ? 'text-emerald-600' : 'text-slate-700'
                                    }`}>
                                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, lang, currency)}
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={item.status} t={t} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => deleteTransaction(item.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all cursor-pointer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-16 text-center text-slate-400 font-medium">
                                    {t('noTransactions')}
                                </td>
                            </tr>
                        )}

                        {hasMore && transactions.length > 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-6 text-center">
                                    <button
                                        onClick={loadMore}
                                        disabled={loading}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        {loading ? t('loading') || 'Loading...' : t('loadMore') || 'Load More'}
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransactionTable;
