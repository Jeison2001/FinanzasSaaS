/**
 * Modal de Creación/Edición de Transacciones.
 * 6 tipos de movimiento (constants.transactionTypes) con campos dinámicos:
 * cuenta (income/expense), cuenta origen+destino (transfer), tarjeta
 * (card_purchase/card_payment) o préstamo (loan_payment) — los selects se
 * poblan desde useEntities. El monto/descripción/fecha/estado se mantienen.
 * Auto-ajusta el estado a 'pendiente' si la fecha es futura.
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { categories, transactionTypes } from '../../utils/constants';
import { useEntities } from '../../hooks/useEntities';

/** Acento de cada tipo en el selector (income/expense conservan el original). */
const TYPE_COLORS = {
    income: 'text-emerald-600',
    expense: 'text-rose-600',
    transfer: 'text-sky-600',
    card_purchase: 'text-violet-600',
    card_payment: 'text-teal-600',
    loan_payment: 'text-amber-600'
};

/** Refs permitidas por tipo (espejo de REF_ALLOWED_FIELDS del server): al
    cambiar de tipo se limpian las heredadas que dejan de ser coherentes. */
const refsAllowedFor = (type) => ({
    accountId: ['income', 'expense', 'transfer', 'card_payment', 'loan_payment'].includes(type),
    transferAccountId: type === 'transfer',
    cardId: ['card_purchase', 'card_payment'].includes(type),
    loanId: type === 'loan_payment'
});

/** Categorías editables por tipo: card_purchase cuenta como gasto (mismas
    categorías); transfer y pagos no impactan KPIs → cat_others fijo. */
const categoryPoolFor = (type) => {
    if (type === 'income') return categories.income;
    if (type === 'expense' || type === 'card_purchase') return categories.expense;
    return null;
};

const emptyRefs = { accountId: '', transferAccountId: '', cardId: '', loanId: '' };

const AddTransactionModal = ({
    setShowAddModal,
    addTransaction,
    editTransaction,
    transactionToEdit,
    currency,
    t
}) => {
    const { accounts, cards, loans } = useEntities();

    const [formData, setFormData] = useState({
        type: 'expense',
        category: 'cat_others',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        recurrence: 'none',
        ...emptyRefs
    });

    // Bloquea el scroll del documento (html + body) mientras el modal está
    // abierto: sin esto, el scrollbar de la ventana queda visible al lado del
    // modal (reporte del usuario).
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

    useEffect(() => {
        if (transactionToEdit) {
            // Las refs llegan en snake_case desde el listado SQL del server.
            setFormData({
                type: transactionToEdit.type,
                category: transactionToEdit.category,
                amount: transactionToEdit.amount,
                description: transactionToEdit.description,
                date: transactionToEdit.date,
                status: transactionToEdit.status,
                recurrence: transactionToEdit.recurrence || 'none',
                accountId: transactionToEdit.account_id || '',
                transferAccountId: transactionToEdit.transfer_account_id || '',
                cardId: transactionToEdit.card_id || '',
                loanId: transactionToEdit.loan_id || ''
            });
        }
    }, [transactionToEdit]);

    const handleTypeChange = (type) => {
        const allow = refsAllowedFor(type);
        setFormData(prev => ({
            ...prev,
            type,
            // income conserva su categoría por defecto; el resto parte de Otros.
            category: type === 'income' ? 'cat_salary' : 'cat_others',
            accountId: allow.accountId ? prev.accountId : '',
            transferAccountId: allow.transferAccountId ? prev.transferAccountId : '',
            cardId: allow.cardId ? prev.cardId : '',
            loanId: allow.loanId ? prev.loanId : ''
        }));
    };

    // Validación cliente de la transferencia: cuenta origen ≠ destino. Los
    // campos vacíos los cubre el `required` nativo de cada select.
    const transferInvalid =
        formData.type === 'transfer' &&
        !!formData.accountId &&
        !!formData.transferAccountId &&
        formData.accountId === formData.transferAccountId;

    const handleAddTransaction = async (e) => {
        e.preventDefault();
        if (transferInvalid) return;

        try {
            // Las refs viajan SIEMPRE (null cuando quedan vacías): en el PUT
            // el server distingue 'campo presente' de 'campo ausente' para
            // limpiar refs heredadas de un tipo anterior.
            const payload = {
                type: formData.type,
                category: formData.category,
                amount: formData.amount,
                description: formData.description,
                date: formData.date,
                status: formData.status,
                recurrence: formData.recurrence,
                accountId: formData.accountId || null,
                transferAccountId: formData.transferAccountId || null,
                cardId: formData.cardId || null,
                loanId: formData.loanId || null
            };
            // El modal solo cierra si el servidor confirmó el guardado;
            // en error, el toast notifica y el usuario puede corregir.
            const res = transactionToEdit
                ? await editTransaction(transactionToEdit.id, payload)
                : await addTransaction(payload);
            if (res?.ok !== false) setShowAddModal(false);
        } catch (error) {
            console.error('[AddTransactionModal] Error al procesar transacción:', error);
        }
    };

    const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm";
    const selectCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xs cursor-pointer hover:bg-slate-100 transition-colors";
    const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1";
    // Etiquetas con keys literales (rastreables por server/i18n-audit.mjs);
    // el VALUE sigue viniendo de constants.transactionTypes (única fuente).
    const TYPE_LABELS = {
        income: t('income'),
        expense: t('expense'),
        transfer: t('tx_transfer'),
        card_purchase: t('tx_card_purchase'),
        card_payment: t('tx_card_payment'),
        loan_payment: t('tx_loan_payment')
    };
    const categoryPool = categoryPoolFor(formData.type);
    // Contrato §API.5: income/expense exigen cuenta — el server conserva la
    // ruta legacy sin cuenta (suite preexistente + reimportación de CSVs
    // antiguos, ver REF_REQUIREMENTS en entities.service.js), así que la
    // exigencia vive aquí: con cuentas existentes el select es obligatorio.
    // Sin cuentas sigue permitido (no hay ninguna a la que aterrizar; la
    // línea base E2E crea movimientos antes de crear entidades).
    const accountRequired =
        (formData.type === 'income' || formData.type === 'expense') && accounts.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-md max-h-[92dvh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain rounded-[2rem] shadow-2xl p-4 sm:p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-black text-slate-800 tracking-tighter">
                        {t('addTransaction')}
                    </h2>
                    <button
                        onClick={() => setShowAddModal(false)}
                        className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500 transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-3">
                    <div className="space-y-1">
                        <label className={labelCls}>{t('tipoMovimiento')}</label>
                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                            {transactionTypes.map(({ value }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleTypeChange(value)}
                                    aria-pressed={formData.type === value}
                                    title={TYPE_LABELS[value]}
                                    className={`py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${formData.type === value ? `bg-white ${TYPE_COLORS[value]} shadow-sm` : 'text-slate-400'}`}
                                >
                                    {TYPE_LABELS[value]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelCls}>
                            {t('description')}
                        </label>
                        <input
                            type="text"
                            required
                            className={inputCls}
                            value={formData.description}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, description: val }));
                            }}
                        />
                    </div>

                    {/* Campos dinámicos según tipo: entidad(es) de referencia +
                        recurrencia en grilla 2-col (el modal debe caber en móvil
                        sin scroll interno — regresión testada en e2e). */}
                    {formData.type === 'transfer' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className={labelCls}>{t('cuentaOrigen')}</label>
                                <select
                                    required
                                    className={selectCls}
                                    value={formData.accountId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                                >
                                    <option value="">—</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>{t('cuentaDestino')}</label>
                                <select
                                    required
                                    className={selectCls}
                                    value={formData.transferAccountId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, transferAccountId: e.target.value }))}
                                >
                                    <option value="">—</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <label className={labelCls}>{t('recurrence')}</label>
                                <select
                                    className={selectCls}
                                    value={formData.recurrence || 'none'}
                                    onChange={(e) => setFormData(prev => ({ ...prev, recurrence: e.target.value }))}
                                >
                                    <option value="none">{t('none')}</option>
                                    <option value="daily">{t('daily')}</option>
                                    <option value="weekly">{t('weekly')}</option>
                                    <option value="monthly">{t('monthly')}</option>
                                    <option value="yearly">{t('yearly')}</option>
                                </select>
                            </div>
                            {transferInvalid && formData.accountId && formData.transferAccountId && (
                                <p className="text-xs font-bold text-rose-600 col-span-2">{t('cuentasDistintas')}</p>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {(formData.type === 'income' || formData.type === 'expense' || formData.type === 'card_payment' || formData.type === 'loan_payment') && (
                                <div className="space-y-1">
                                    <label className={labelCls}>
                                        {t('cuenta')}{!accountRequired ? ` (${t('opcional')})` : ''}
                                    </label>
                                    <select
                                        required={accountRequired}
                                        className={selectCls}
                                        value={formData.accountId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                                    >
                                        <option value="">—</option>
                                        {accounts.length === 0 && <option disabled>{t('sinCuentas')}</option>}
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {(formData.type === 'card_purchase' || formData.type === 'card_payment') && (
                                <div className="space-y-1">
                                    <label className={labelCls}>{t('tarjeta')}</label>
                                    <select
                                        required
                                        className={selectCls}
                                        value={formData.cardId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cardId: e.target.value }))}
                                    >
                                        <option value="">—</option>
                                        {cards.length === 0 && <option disabled>{t('sinTarjetas')}</option>}
                                        {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {formData.type === 'loan_payment' && (
                                <div className="space-y-1">
                                    <label className={labelCls}>{t('prestamo')}</label>
                                    <select
                                        required
                                        className={selectCls}
                                        value={formData.loanId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, loanId: e.target.value }))}
                                    >
                                        <option value="">—</option>
                                        {loans.length === 0 && <option disabled>{t('sinPrestamos')}</option>}
                                        {loans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className={labelCls}>
                                    {t('recurrence')}
                                </label>
                                <select
                                    className={selectCls}
                                    value={formData.recurrence || 'none'}
                                    onChange={(e) => setFormData(prev => ({ ...prev, recurrence: e.target.value }))}
                                >
                                    <option value="none">{t('none')}</option>
                                    <option value="daily">{t('daily')}</option>
                                    <option value="weekly">{t('weekly')}</option>
                                    <option value="monthly">{t('monthly')}</option>
                                    <option value="yearly">{t('yearly')}</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelCls}>
                                {t('amount')} ({currency})
                            </label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                className={inputCls}
                                value={formData.amount}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, amount: val }));
                                }}
                            />
                        </div>
                        {categoryPool && (
                            <div className="space-y-1">
                                <label className={labelCls}>
                                    {t('category')}
                                </label>
                                <select
                                    className={selectCls}
                                    value={formData.category}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, category: val }));
                                    }}
                                >
                                    {categoryPool.map(ck => (
                                        <option key={ck} value={ck}>{t(ck)}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelCls}>
                                {t('date')}
                            </label>
                            <input
                                type="date"
                                className={inputCls}
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
                            <label className={labelCls}>
                                {t('status')}
                            </label>
                            <select
                                className={selectCls}
                                value={formData.status}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, status: val }));
                                }}
                            >
                                <option value="completed">{t('confirmed')}</option>
                                <option value="planned">{t('pending')}</option>
                                {/* Editar una vencida: mostrar y conservar su estado real */}
                                {transactionToEdit?.status === 'overdue' && (
                                    <option value="overdue">{t('overdue')}</option>
                                )}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={transferInvalid}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-3.5 rounded-2xl transition-all shadow-xl shadow-emerald-100 cursor-pointer"
                    >
                        {t('save')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddTransactionModal;
