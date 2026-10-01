import React, { useEffect } from 'react';

import { X } from 'lucide-react';

const SetGoalModal = ({
    savingsGoal,
    setSavingsGoal,
    setShowGoalModal,
    currency,
    saveSettings,
    t
}) => {
    // Bloquea el scroll del documento mientras el modal está abierto: sin esto,
    // el scrollbar del body queda visible al lado del modal (reporte del usuario).
    useEffect(() => {
        const prevHtml = document.documentElement.style.overflow;
        const prevBody = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        return () => {
            document.documentElement.style.overflow = prevHtml;
            document.body.style.overflow = prevBody;
        };
    }, []);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-sm max-h-[90dvh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-[2.5rem] shadow-2xl p-5 sm:p-8 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-black text-slate-800 tracking-tighter">
                        {t('setGoal')}
                    </h2>
                    <button
                        onClick={() => setShowGoalModal(false)}
                        className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500 transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            {t('goalAmount')} ({currency})
                        </label>
                        <input
                            type="number"
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-2xl font-black tracking-tight"
                            value={savingsGoal}
                            onChange={(e) => setSavingsGoal(parseFloat(e.target.value) || 0)}
                        />
                    </div>

                    <button
                        onClick={async () => {
                            const res = await saveSettings({ savings_goal: savingsGoal });
                            if (res?.ok !== false) setShowGoalModal(false);
                        }}
                        disabled={!(savingsGoal > 0)}
                        title={!(savingsGoal > 0) ? t('goalMustBePositive') : undefined}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-xl shadow-emerald-100 cursor-pointer"
                    >
                        {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetGoalModal;
