/**
 * Modal de Creación/Edición de Transacciones.
 * Permite configurar tipo, categoría, monto, fecha y reglas de recurrencia.
 * Auto-ajusta el estado a 'pendiente' si la fecha es futura.
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { categories } from '../../utils/constants';

const AddTransactionModal = ({
    setShowAddModal,
    addTransaction,
    editTransaction,
    transactionToEdit,
    currency,
    t
}) => {
    const [formData, setFormData] = useState({
        type: 'expense',
        category: 'cat_others',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        recurrence: 'none'
    });

    useEffect(() => {
        if (transactionToEdit) {
            setFormData({
                type: transactionToEdit.type,
                category: transactionToEdit.category,
                amount: transactionToEdit.amount,
                description: transactionToEdit.description,
                date: transactionToEdit.date,
                status: transactionToEdit.status,
                recurrence: transactionToEdit.recurrence || 'none',
            });
        }
    }, [transactionToEdit]);

    const handleAddTransaction = (e) => {
        e.preventDefault();

        try {
            if (transactionToEdit) {
                editTransaction(transactionToEdit.id, formData);
            } else {
                addTransaction(formData);
            }
            setShowAddModal(false);
        } catch (error) {
            console.error('[AddTransactionModal] Error al procesar transacción:', error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter">
                        {t('addTransaction')}
                    </h2>
                    <button
                        onClick={() => setShowAddModal(false)}
                        className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500 transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-5">
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, type: 'expense', category: 'cat_others' }))}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${formData.type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            {t('expense')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, type: 'income', category: 'cat_salary' }))}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${formData.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            {t('income')}
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            {t('description')}
                        </label>
                        <input
                            type="text"
                            required
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                            value={formData.description}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, description: val }));
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {t('amount')} ({currency})
                            </label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                                value={formData.amount}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, amount: val }));
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {t('category')}
                            </label>
                            <select
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                                value={formData.category}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, category: val }));
                                }}
                            >
                                {categories[formData.type].map(ck => (
                                    <option key={ck} value={ck}>{t(ck)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {t('date')}
                            </label>
                            <input
                                type="date"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold"
                                value={formData.date}
                                onChange={(e) => {
                                    const newDate = e.target.value;
                                    const isFuture = new Date(newDate) > new Date();
                                    setFormData(prev => ({
                                        ...prev,
                                        date: newDate,
                                        status: isFuture ? 'planned' : 'completed'
                                    }));
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {t('status')}
                            </label>
                            <select
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                                value={formData.status}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, status: val }));
                                }}
                            >
                                <option value="completed">{t('confirmed')}</option>
                                <option value="planned">{t('pending')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            {t('recurrence')}
                        </label>
                        <select
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                            value={formData.recurrence || 'none'}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, recurrence: val }));
                            }}
                        >
                            <option value="none">{t('none')}</option>
                            <option value="daily">{t('daily')}</option>
                            <option value="weekly">{t('weekly')}</option>
                            <option value="monthly">{t('monthly')}</option>
                            <option value="yearly">{t('yearly')}</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-xl shadow-emerald-100 mt-4 cursor-pointer"
                    >
                        {t('save')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddTransactionModal;
