/**
 * Toaster — feedback visible de errores de API.
 * Los hooks notifican vía pushToast del store; este componente los muestra
 * 4.5s con auto-dismiss. Sin él, los fallos de red/validación eran invisibles
 * (console.error se elimina del bundle de producción).
 */
import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const Toast = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 4500);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    const isError = toast.type === 'error';
    return (
        <div
            role="status"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border text-sm font-bold max-w-xs animate-in slide-in-from-bottom-2 fade-in duration-200 ${
                isError
                    ? 'bg-white text-rose-700 border-rose-200'
                    : 'bg-white text-emerald-700 border-emerald-200'
            }`}
        >
            {isError
                ? <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                : <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 text-slate-300 hover:text-slate-500 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
                <X size={14} />
            </button>
        </div>
    );
};

const Toaster = () => {
    const toasts = useAppStore((s) => s.toasts);
    const dismissToast = useAppStore((s) => s.dismissToast);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
            ))}
        </div>
    );
};

export default Toaster;
