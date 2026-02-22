import React from 'react';
import { PlusCircle, Wallet2 } from 'lucide-react';

const EmptyState = ({ setShowAddModal, t }) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm mt-6">
            <div className="bg-slate-50 p-6 rounded-full mb-6">
                <Wallet2 size={48} className="text-emerald-400" />
            </div>

            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3">
                {t('emptyStateTitle')}
            </h3>

            <p className="text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">
                {t('emptyStateDesc')}
            </p>

            <button
                onClick={() => setShowAddModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-emerald-200 font-bold cursor-pointer"
            >
                <PlusCircle size={20} />
                {t('addFirstTransaction')}
            </button>
        </div>
    );
};

export default EmptyState;
