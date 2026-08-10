/**
 * Modal de Import/Export CSV.
 * Export: descarga el CSV del servidor (autenticado).
 * Import: pega contenido CSV, valida fila a fila en el servidor y refresca.
 */
import React, { useState } from 'react';
import { X, Download, Upload, FileDown } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const ImportExportModal = ({ setShowModal, t, onImported }) => {
    const [csvText, setCsvText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { imported, errors }

    const handleExport = async () => {
        try {
            const res = await axiosClient.get('/transactions/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finanzasSaaS_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[ImportExportModal] Error al exportar CSV:', err);
            alert(t('authErrorGeneric'));
        }
    };

    const handleDownloadTemplate = () => {
        const template = 'date,type,category,amount,description,status,recurrence\n2026-08-01,expense,cat_food,45.50,Compra semanal,completed,none\n2026-08-02,income,cat_salary,2000,Nómina,completed,none';
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_transacciones.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleImport = async () => {
        if (!csvText.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await axiosClient.post('/transactions/import', { csv: csvText });
            setResult(res.data);
            setCsvText('');
            if (onImported) onImported();
        } catch (err) {
            console.error('[ImportExportModal] Error al importar CSV:', err);
            alert(err.response?.data?.error || t('authErrorGeneric'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter">
                        {t('importTitle')}
                    </h2>
                    <button
                        onClick={() => setShowModal(false)}
                        className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500 transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex gap-2 mb-6">
                    <button
                        onClick={handleExport}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                    >
                        <Download size={14} /> {t('exportCSV')}
                    </button>
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                    >
                        <FileDown size={14} /> {t('downloadTemplate')}
                    </button>
                </div>

                <p className="text-xs font-medium text-slate-400 mb-3 leading-relaxed">{t('importDesc')}</p>

                <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={8}
                    placeholder="2026-08-01,expense,cat_food,45.50,Compra semanal,completed,none"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-mono"
                />

                {result && (
                    <div className={`mt-4 p-3 rounded-xl text-sm font-bold text-center ${result.errors?.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {result.errors?.length > 0
                            ? t('importPartial').replace('{ok}', result.imported).replace('{err}', result.errors.length)
                            : t('importSuccess').replace('{n}', result.imported)}
                    </div>
                )}

                <button
                    onClick={handleImport}
                    disabled={loading || !csvText.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-xl shadow-emerald-100 mt-4 flex items-center justify-center gap-2 cursor-pointer"
                >
                    <Upload size={16} /> {loading ? '...' : t('importCSV')}
                </button>
            </div>
        </div>
    );
};

export default ImportExportModal;
