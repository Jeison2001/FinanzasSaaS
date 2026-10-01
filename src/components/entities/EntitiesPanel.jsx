/**
 * Panel de Entidades: cuentas, tarjetas de crédito y préstamos.
 * Resumen de 4 tarjetas (Patrimonio Neto destacado con degradado indigo),
 * listas con barras de progreso/semáforo y formularios de creación/edición.
 *
 * El saldo de cuenta, el usado de tarjeta y lo pagado del préstamo NO se
 * calculan aquí: llegan derivados del server (agregación SQL) vía useEntities
 * (listas CRUD) y useOverview (resumen, montado en App.jsx que lo refresca
 * tras cada mutación de movimientos). Tras crear/editar/borrar una entidad se
 * recargan ambos.
 */
import React, { useState, useMemo } from 'react';
import { Wallet, CreditCard, Landmark, Sparkles, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useEntities } from '../../hooks/useEntities';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../utils/formatters';

/**
 * Matemática de préstamos replicada de server/utils/loan.utils.js PERO en
 * unidades de moneda: alimenta SOLO el cálculo en vivo del formulario
 * (preview mientras se escribe). El valor persistido lo recalcula el server
 * en céntimos exactos — el cliente nunca es la fuente de verdad.
 */
const monthlyPaymentUnits = (principal, annualRatePct, n) => {
    const i = (annualRatePct / 100) / 12;
    if (i === 0) return principal / n;
    return (principal * i) / (1 - Math.pow(1 + i, -n));
};

const impliedAnnualRateUnits = (principal, n, payment) => {
    if (payment * n <= principal) return 0;
    const paymentAt = (i) => (principal * i) / (1 - Math.pow(1 + i, -n));
    let lo = 0;
    let hi = 1;
    while (paymentAt(hi) < payment) {
        hi *= 2;
        if (!Number.isFinite(hi)) return 0;
    }
    for (let k = 0; k < 200; k++) {
        const mid = (lo + hi) / 2;
        if (paymentAt(mid) < payment) lo = mid; else hi = mid;
    }
    return Math.round(((lo + hi) / 2) * 12 * 100 * 100) / 100;
};

const emptyLoanDraft = { name: '', principal_amount: '', installments: '', mode: 'rate', annual_rate_pct: '', monthly_payment_amount: '' };
const emptyCardDraft = { name: '', limit_amount: '', cut_day: '1', min_payment_pct: '5' };
const emptyAccountDraft = { name: '', initial_amount: '' };

const Spinner = () => (
    <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
);

/** Fila de la live-info del formulario de préstamo. */
const LiveRow = ({ label, value, accent }) => (
    <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{label}</span>
        <span className={`text-sm font-black ${accent || 'text-emerald-700'}`}>{value}</span>
    </div>
);

/** Botones editar/eliminar de cada fila de entidad. */
const RowActions = ({ onEdit, onDelete, t }) => (
    <div className="flex items-center gap-1.5 shrink-0">
        <button
            onClick={onEdit}
            title={t('editar')}
            aria-label={t('editar')}
            className="bg-slate-100 hover:bg-emerald-100 hover:text-emerald-600 text-slate-500 p-2 rounded-xl transition-all cursor-pointer"
        >
            <Pencil size={14} />
        </button>
        <button
            onClick={onDelete}
            title={t('eliminar')}
            aria-label={t('eliminar')}
            className="bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-500 p-2 rounded-xl transition-all cursor-pointer"
        >
            <Trash2 size={14} />
        </button>
    </div>
);

const EntitiesPanel = ({ lang, currency, t, overview, overviewLoading, reloadOverview }) => {
    const { accounts, cards, loans, loading, reload } = useEntities();
    const [formKind, setFormKind] = useState(null); // 'account' | 'card' | 'loan' | null
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [accountDraft, setAccountDraft] = useState(emptyAccountDraft);
    const [cardDraft, setCardDraft] = useState(emptyCardDraft);
    const [loanDraft, setLoanDraft] = useState(emptyLoanDraft);
    const [adoptTarget, setAdoptTarget] = useState(''); // id de cuenta del banner de huérfanos
    const [adopting, setAdopting] = useState(false);

    const notifyError = (err) => {
        const { pushToast } = useAppStore.getState();
        pushToast(err?.response?.data?.error || t('authErrorGeneric'), 'error');
    };

    // Una sola mutación de entidad refresca las dos vistas derivadas.
    const refreshAll = () => { reload(); reloadOverview(); };

    const openForm = (kind, entity = null) => {
        setFormKind(kind);
        setEditingId(entity?.id || null);
        if (kind === 'account') {
            setAccountDraft(entity
                ? { name: entity.name, initial_amount: String(entity.initial_amount ?? '') }
                : emptyAccountDraft);
        } else if (kind === 'card') {
            setCardDraft(entity
                ? {
                    name: entity.name,
                    limit_amount: String(entity.limit_amount ?? ''),
                    cut_day: String(entity.cut_day ?? 1),
                    min_payment_pct: String(entity.min_payment_pct ?? 5)
                }
                : emptyCardDraft);
        } else {
            // En edición se prellenan ambos valores (el DTO guarda el par
            // tasa/cuota fijado en creación); el toggle decide cuál manda.
            setLoanDraft(entity
                ? {
                    name: entity.name,
                    principal_amount: String(entity.principal_amount ?? ''),
                    installments: String(entity.installments ?? ''),
                    mode: 'rate',
                    annual_rate_pct: String(entity.annual_rate_pct ?? ''),
                    monthly_payment_amount: String(entity.monthly_payment_amount ?? '')
                }
                : emptyLoanDraft);
        }
    };

    const closeForm = () => { setFormKind(null); setEditingId(null); };

    const submitAccount = async (e) => {
        e.preventDefault();
        const name = accountDraft.name.trim();
        const initial = parseFloat(accountDraft.initial_amount);
        if (!name || isNaN(initial) || initial < 0) return;
        setSaving(true);
        try {
            if (editingId) await axiosClient.put(`/accounts/${editingId}`, { name, initial_amount: initial });
            else await axiosClient.post('/accounts', { name, initial_amount: initial });
            closeForm();
            refreshAll();
        } catch (err) {
            notifyError(err);
        } finally {
            setSaving(false);
        }
    };

    const submitCard = async (e) => {
        e.preventDefault();
        const name = cardDraft.name.trim();
        const limit = parseFloat(cardDraft.limit_amount);
        const cutDay = parseInt(cardDraft.cut_day, 10);
        const pct = parseFloat(cardDraft.min_payment_pct);
        if (!name || !(limit > 0) || !(cutDay >= 1 && cutDay <= 31) || !(pct >= 0 && pct <= 100)) return;
        setSaving(true);
        try {
            const body = { name, limit_amount: limit, cut_day: cutDay, min_payment_pct: pct };
            if (editingId) await axiosClient.put(`/cards/${editingId}`, body);
            else await axiosClient.post('/cards', body);
            closeForm();
            refreshAll();
        } catch (err) {
            notifyError(err);
        } finally {
            setSaving(false);
        }
    };

    // Cálculo EN VIVO del préstamo (unidades): cuota/tasa implícita + total
    // + intereses, y flag de cuota insuficiente (server lo rechaza con 400:
    // cuota×n < principal — misma condición, replicada para avisar antes).
    const loanLive = useMemo(() => {
        const principal = parseFloat(loanDraft.principal_amount);
        const n = parseInt(loanDraft.installments, 10);
        if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(n) || n < 1) return null;
        const rate = parseFloat(loanDraft.annual_rate_pct) || 0;
        const payment = parseFloat(loanDraft.monthly_payment_amount) || 0;
        if (loanDraft.mode === 'payment') {
            const notCovered = payment > 0 && payment * n < principal;
            return {
                mode: 'payment',
                payment,
                rate: payment > 0 ? impliedAnnualRateUnits(principal, n, payment) : null,
                total: payment > 0 ? payment * n : null,
                interest: payment > 0 ? payment * n - principal : null,
                notCovered
            };
        }
        const cuota = monthlyPaymentUnits(principal, rate, n);
        return {
            mode: 'rate',
            payment: cuota,
            rate: null,
            total: cuota * n,
            interest: cuota * n - principal,
            notCovered: false
        };
    }, [loanDraft]);

    const submitLoan = async (e) => {
        e.preventDefault();
        if (loanLive?.notCovered) return;
        const name = loanDraft.name.trim();
        const principal = parseFloat(loanDraft.principal_amount);
        const n = parseInt(loanDraft.installments, 10);
        if (!name || !(principal > 0) || !(n >= 1 && n <= 600)) return;
        setSaving(true);
        try {
            // XOR del schema: exactamente UNA de las dos claves viaja según
            // el modo del toggle; el server calcula la otra en céntimos.
            const body = { name, principal_amount: principal, installments: n };
            if (loanDraft.mode === 'payment') {
                const payment = parseFloat(loanDraft.monthly_payment_amount);
                if (!(payment > 0)) { setSaving(false); return; }
                body.monthly_payment_amount = payment;
            } else {
                body.annual_rate_pct = parseFloat(loanDraft.annual_rate_pct) || 0;
            }
            if (editingId) await axiosClient.put(`/loans/${editingId}`, body);
            else await axiosClient.post('/loans', body);
            closeForm();
            refreshAll();
        } catch (err) {
            notifyError(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (path) => {
        if (!window.confirm(t('confirmDeleteEntity'))) return;
        try {
            await axiosClient.delete(path);
            refreshAll();
        } catch (err) {
            notifyError(err);
        }
    };

    // ── Huérfanos legacy: income/expense históricos sin cuenta ──────────
    // La decisión de a qué cuenta van es del USUARIO: resumen exacto en el
    // banner (overview.orphans), elección de cuenta y confirmación previa.
    const orphans = overview?.orphans;
    const orphanCount = orphans?.count ?? 0;
    // Selección por defecto: la primera cuenta, sin useEffect (la lista del
    // store manda en cuanto llega).
    const adoptTargetId = adoptTarget || accounts[0]?.id || '';

    const handleAdoptOrphans = async () => {
        const target = accounts.find(a => a.id === adoptTargetId);
        if (!target) return;
        if (!window.confirm(t('orphansConfirm').replace('{n}', String(orphanCount)))) return;
        setAdopting(true);
        try {
            const res = await axiosClient.post(`/accounts/${target.id}/adopt-orphans`);
            const { pushToast } = useAppStore.getState();
            pushToast(
                t('orphansDone').replace('{n}', String(res.data?.assigned ?? orphanCount)).replace('{name}', target.name),
                'success'
            );
            refreshAll();
        } catch (err) {
            notifyError(err);
        } finally {
            setAdopting(false);
        }
    };

    const inputCls = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold";
    const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1";
    const primaryBtnCls = "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md font-bold text-sm cursor-pointer";
    const secondaryBtnCls = "bg-slate-100 hover:bg-slate-200 text-slate-500 px-5 py-2 rounded-xl transition-all font-bold text-sm cursor-pointer";
    const newBtnCls = "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-md cursor-pointer shrink-0";

    const summaryCards = [
        { key: 'cuentas', icon: Wallet, iconCls: 'bg-emerald-600 text-white', value: overview?.accountsTotal ?? 0, negative: false },
        { key: 'tarjetas', icon: CreditCard, iconCls: 'bg-rose-50 text-rose-600', value: overview?.cardsUsed ?? 0, negative: true },
        { key: 'prestamos', icon: Landmark, iconCls: 'bg-amber-50 text-amber-600', value: overview?.loansRemaining ?? 0, negative: true }
    ];

    return (
        <div className="mt-6 space-y-6">
            {/* Cabecera */}
            <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm gap-2">
                <h2 className="text-xl font-black tracking-tight text-slate-800 md:ml-4 flex items-center gap-2">
                    <Landmark size={22} className="text-emerald-600" />
                    {t('entidades')}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest md:mr-4">{t('cuentasYDeudas')}</p>
            </div>

            {/* Resumen: 3 totales + Patrimonio Neto destacado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                {summaryCards.map(({ key, icon: Icon, iconCls, value, negative }) => (
                    <div key={key} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg ${iconCls}`}>
                                <Icon size={20} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t(key)}</p>
                        <p className={`text-2xl font-black tracking-tight leading-none ${negative && value > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {/* El signo solo aplica a deuda REAL: un 0 nunca se muestra como −0,00 */}
                            {negative && value > 0 ? `−${formatCurrency(Math.abs(value), lang, currency)}` : formatCurrency(value, lang, currency)}
                        </p>
                    </div>
                ))}

                {/* Patrimonio Neto — tarjeta destacada con degradado indigo */}
                <div className="bg-slate-950 border-0 p-5 rounded-3xl shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-white/20 text-white rounded-lg">
                            <Sparkles size={20} />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-0.5">{t('patrimonioNeto')}</p>
                    <p className={`text-2xl font-black tracking-tight leading-none ${(overview?.netWorth ?? 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        {formatCurrency(overview?.netWorth ?? 0, lang, currency)}
                    </p>
                </div>
            </div>

            {(overviewLoading && !overview) && <Spinner />}

            {/* Huérfanos legacy: movimientos históricos sin cuenta — misma
                estética que la alerta de vencidos de KPICards. Con cuentas:
                selector + asignación con confirmación. Sin cuentas: banner
                sin selector y botón deshabilitado con title explicativo. */}
            {orphanCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 shadow-sm">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <p className="text-sm font-bold text-amber-800 flex-1 min-w-0">
                        {t('orphansBanner').replace('{n}', String(orphanCount)).replace('{amount}', formatCurrency(orphans.net ?? 0, lang, currency))}
                    </p>
                    {accounts.length > 0 && (
                        <select
                            value={adoptTargetId}
                            onChange={(e) => setAdoptTarget(e.target.value)}
                            aria-label={t('cuenta')}
                            className="px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm font-bold text-amber-800 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shrink-0"
                        >
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={handleAdoptOrphans}
                        disabled={!adoptTargetId || adopting}
                        title={accounts.length > 0 ? t('orphansAssign') : t('orphansNoAccounts')}
                        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer shrink-0"
                    >
                        {t('orphansAssign')}
                    </button>
                </div>
            )}

            {/* Cuentas */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <Wallet size={16} className="text-emerald-600" /> {t('cuentas')}
                    </h3>
                    <button onClick={() => openForm('account')} className={newBtnCls}>
                        <Plus size={14} /> {t('nuevaCuenta')}
                    </button>
                </div>

                {formKind === 'account' && (
                    <form onSubmit={submitAccount} className="bg-slate-50 rounded-2xl p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className={labelCls}>{t('nombreCuenta')}</label>
                                <input type="text" required value={accountDraft.name}
                                    onChange={(e) => setAccountDraft(p => ({ ...p, name: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>{t('saldoInicial')} ({currency})</label>
                                <input type="number" required min="0" step="0.01" value={accountDraft.initial_amount}
                                    onChange={(e) => setAccountDraft(p => ({ ...p, initial_amount: e.target.value }))}
                                    className={inputCls} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={saving} className={primaryBtnCls}>{t('save')}</button>
                            <button type="button" onClick={closeForm} className={secondaryBtnCls}>{t('cancelar')}</button>
                        </div>
                    </form>
                )}

                {loading && accounts.length === 0 ? <Spinner /> : accounts.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400">{t('sinCuentas')}</p>
                ) : (
                    <div className="space-y-3">
                        {accounts.map(a => (
                            <div key={a.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl px-4 py-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-700 truncate">{a.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {t('saldoInicial')}: {formatCurrency(a.initial_amount ?? 0, lang, currency)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-sm font-black ${a.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatCurrency(a.balance, lang, currency)}
                                    </span>
                                    <RowActions t={t} onEdit={() => openForm('account', a)} onDelete={() => handleDelete(`/accounts/${a.id}`)} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tarjetas de crédito */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <CreditCard size={16} className="text-rose-500" /> {t('tarjetas')}
                    </h3>
                    <button onClick={() => openForm('card')} className={newBtnCls}>
                        <Plus size={14} /> {t('nuevaTarjeta')}
                    </button>
                </div>

                {formKind === 'card' && (
                    <form onSubmit={submitCard} className="bg-slate-50 rounded-2xl p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className={labelCls}>{t('nombre')}</label>
                                <input type="text" required value={cardDraft.name}
                                    onChange={(e) => setCardDraft(p => ({ ...p, name: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>{t('cupoTotal')} ({currency})</label>
                                <input type="number" required min="0.01" step="0.01" value={cardDraft.limit_amount}
                                    onChange={(e) => setCardDraft(p => ({ ...p, limit_amount: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>{t('diaCorte')}</label>
                                <input type="number" required min="1" max="31" step="1" value={cardDraft.cut_day}
                                    onChange={(e) => setCardDraft(p => ({ ...p, cut_day: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>{t('pagoMinPct')}</label>
                                <input type="number" required min="0" max="100" step="0.1" value={cardDraft.min_payment_pct}
                                    onChange={(e) => setCardDraft(p => ({ ...p, min_payment_pct: e.target.value }))}
                                    className={inputCls} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={saving} className={primaryBtnCls}>{t('save')}</button>
                            <button type="button" onClick={closeForm} className={secondaryBtnCls}>{t('cancelar')}</button>
                        </div>
                    </form>
                )}

                {loading && cards.length === 0 ? <Spinner /> : cards.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400">{t('sinTarjetas')}</p>
                ) : (
                    <div className="space-y-4">
                        {cards.map(c => {
                            const limit = c.limit_amount ?? 0; // DTO de GET /cards
                            const used = c.used ?? 0;
                            // Semáforo de uso, mismos umbrales que BudgetsPanel:
                            // >=100% rojo, >=80% ámbar, resto verde.
                            const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                            const pctDisplay = limit > 0 ? ((used / limit) * 100).toFixed(0) : '—';
                            const barColor = limit > 0 && used >= limit ? 'bg-rose-500' : limit > 0 && used >= limit * 0.8 ? 'bg-amber-400' : 'bg-emerald-500';
                            return (
                                <div key={c.id} className="bg-slate-50 rounded-2xl px-4 py-3 space-y-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-black text-slate-700 truncate">{c.name}</p>
                                        <RowActions t={t} onEdit={() => openForm('card', c)} onDelete={() => handleDelete(`/cards/${c.id}`)} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 min-w-8 text-right">{pctDisplay}%</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>{t('usado')}: <span className="text-rose-600 font-black">{formatCurrency(used, lang, currency)}</span> / {formatCurrency(limit, lang, currency)}</span>
                                        <span>{t('disponible')}: {formatCurrency(c.available ?? 0, lang, currency)}</span>
                                        <span>{t('pagoMinimo')}: {formatCurrency(c.minPayment ?? 0, lang, currency)}</span>
                                        <span>{t('diaCorte')}: {c.cut_day}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Préstamos */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <Landmark size={16} className="text-amber-500" /> {t('prestamos')}
                    </h3>
                    <button onClick={() => openForm('loan')} className={newBtnCls}>
                        <Plus size={14} /> {t('nuevoPrestamo')}
                    </button>
                </div>

                {formKind === 'loan' && (
                    <form onSubmit={submitLoan} className="bg-slate-50 rounded-2xl p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className={labelCls}>{t('nombre')}</label>
                                <input type="text" required value={loanDraft.name}
                                    onChange={(e) => setLoanDraft(p => ({ ...p, name: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>{t('montoPrestamo')} ({currency})</label>
                                <input type="number" required min="0.01" step="0.01" value={loanDraft.principal_amount}
                                    onChange={(e) => setLoanDraft(p => ({ ...p, principal_amount: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelCls}>{t('numCuotas')}</label>
                                <input type="number" required min="1" max="600" step="1" value={loanDraft.installments}
                                    onChange={(e) => setLoanDraft(p => ({ ...p, installments: e.target.value }))}
                                    className={inputCls} />
                            </div>
                        </div>

                        {/* Toggle de modo: la cuota se deduce de la tasa o la tasa de la cuota */}
                        <div className="flex gap-2 p-1.5 bg-slate-200/60 rounded-2xl max-w-md">
                            <button
                                type="button"
                                onClick={() => setLoanDraft(p => ({ ...p, mode: 'rate' }))}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${loanDraft.mode === 'rate' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                {t('modoTasa')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setLoanDraft(p => ({ ...p, mode: 'payment' }))}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${loanDraft.mode === 'payment' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                {t('modoCuota')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                            {loanDraft.mode === 'rate' ? (
                                <div className="space-y-1">
                                    <label className={labelCls}>{t('tasaAnual')}</label>
                                    <input type="number" required min="0" step="0.01" value={loanDraft.annual_rate_pct}
                                        onChange={(e) => setLoanDraft(p => ({ ...p, annual_rate_pct: e.target.value }))}
                                        className={inputCls} />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className={labelCls}>{t('cuotaMensual')} ({currency})</label>
                                    <input type="number" required min="0.01" step="0.01" value={loanDraft.monthly_payment_amount}
                                        onChange={(e) => setLoanDraft(p => ({ ...p, monthly_payment_amount: e.target.value }))}
                                        className={inputCls} />
                                </div>
                            )}
                        </div>

                        {/* Live-info: replica el cálculo del server en unidades */}
                        {loanLive && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-1.5 max-w-md">
                                {loanLive.mode === 'rate' ? (
                                    <LiveRow label={t('cuotaEstimada')} value={formatCurrency(loanLive.payment, lang, currency)} />
                                ) : (
                                    <LiveRow label={t('tasaImplicita')} value={loanLive.rate === null ? '—' : `${loanLive.rate.toFixed(2)}%`} />
                                )}
                                <LiveRow label={t('totalAPagar')} value={loanLive.total === null ? '—' : formatCurrency(loanLive.total, lang, currency)} />
                                <LiveRow
                                    label={t('intereses')}
                                    value={loanLive.interest === null || loanLive.interest < 0 ? '—' : formatCurrency(loanLive.interest, lang, currency)}
                                />
                                {loanLive.notCovered && (
                                    <p className="text-xs font-bold text-rose-600 pt-1">{t('cuotaNoCubre')}</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button type="submit" disabled={saving || loanLive?.notCovered} className={primaryBtnCls}>{t('save')}</button>
                            <button type="button" onClick={closeForm} className={secondaryBtnCls}>{t('cancelar')}</button>
                        </div>
                    </form>
                )}

                {loading && loans.length === 0 ? <Spinner /> : loans.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400">{t('sinPrestamos')}</p>
                ) : (
                    <div className="space-y-4">
                        {loans.map(l => {
                            const n = l.installments || 0;
                            const paidN = l.installmentsPaid ?? 0;
                            const pct = n > 0 ? Math.min((paidN / n) * 100, 100) : 0;
                            return (
                                <div key={l.id} className="bg-slate-50 rounded-2xl px-4 py-3 space-y-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-black text-slate-700 truncate">{l.name}</p>
                                        <RowActions t={t} onEdit={() => openForm('loan', l)} onDelete={() => handleDelete(`/loans/${l.id}`)} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
                                                style={{ width: `${pct}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 min-w-14 text-right">
                                            {t('cuotasPagadas')}: {paidN} {t('de')} {n}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>{t('saldoPendiente')}: <span className="text-amber-600 font-black">{formatCurrency(l.remaining ?? 0, lang, currency)}</span></span>
                                        <span>{t('cuotaMensual')}: {formatCurrency(l.monthly_payment_amount ?? 0, lang, currency)}</span>
                                        <span>{t('tasaAnual')}: {l.annual_rate_pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EntitiesPanel;
