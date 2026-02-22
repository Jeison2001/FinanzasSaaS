/**
 * Componente raíz. Orquesta autenticación, estado global y layout.
 * Admins ven AdminDashboard salvo que activen forceClientView.
 */
import React, { useState } from 'react';
import { useTranslation } from './locales';
import { useTransactions } from './hooks/useTransactions';
import { useFilters } from './hooks/useFilters';
import { useStats } from './hooks/useStats';
import { useAuth } from './hooks/useAuth';

import AuthCard from './components/auth/AuthCard';
import AdminDashboard from './components/admin/AdminDashboard';
import Header from './components/layout/Header';
import KPICards from './components/dashboard/KPICards';
import Sidebar from './components/dashboard/Sidebar';
import TransactionFilters from './components/transactions/TransactionFilters';
import TransactionTable from './components/transactions/TransactionTable';
import AddTransactionModal from './components/transactions/AddTransactionModal';
import SetGoalModal from './components/transactions/SetGoalModal';
import Reports from './components/dashboard/Reports';

const App = () => {
  const { isAuthenticated, role } = useAuth();

  const [lang, setLang] = useState('es');
  const [currency, setCurrency] = useState('EUR');
  const [savingsGoal, setSavingsGoal] = useState(10000);
  const t = useTranslation(lang);

  const [transactionToEdit, setTransactionToEdit] = useState(null);
  const [forceClientView, setForceClientView] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions');

  const { transactions, addTransaction, deleteTransaction, editTransaction } = useTransactions();
  const { filters, setters, filteredTransactions, clearAllFilters } = useFilters(transactions);
  const stats = useStats(transactions, savingsGoal);

  // Abre el modal en modo edición con la transacción seleccionada
  const handleEditClick = (trx) => {
    setTransactionToEdit(trx);
    setShowAddModal(true);
  };

  if (!isAuthenticated) return <AuthCard />;

  if (isAuthenticated && role === 'admin' && !forceClientView) {
    return <AdminDashboard lang={lang} setLang={setLang} setForceClientView={setForceClientView} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <Header
        lang={lang}
        setLang={setLang}
        currency={currency}
        setCurrency={setCurrency}
        setShowAddModal={() => { setTransactionToEdit(null); setShowAddModal(true); }}
        role={role}
        setForceClientView={setForceClientView}
        t={t}
      />

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <KPICards stats={stats} lang={lang} currency={currency} t={t} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {transactions.length === 0 ? (
              <TransactionTable
                transactions={[]}
                totalTransactionsCount={0}
                setShowAddModal={setShowAddModal}
                onEdit={handleEditClick}
                deleteTransaction={deleteTransaction}
                lang={lang}
                currency={currency}
                t={t}
              />
            ) : (
              <>
                {/* Selector de vista: historial o informes */}
                <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200 w-full sm:w-fit mx-auto lg:mx-0">
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-slate-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 cursor-pointer'}`}
                  >
                    {t('history')}
                  </button>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'reports' ? 'bg-slate-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 cursor-pointer'}`}
                  >
                    {t('reports')}
                  </button>
                </div>

                {activeTab === 'transactions' ? (
                  <>
                    <TransactionFilters
                      filters={filters}
                      setters={setters}
                      showFilters={showFilters}
                      setShowFilters={setShowFilters}
                      clearAllFilters={clearAllFilters}
                      lang={lang}
                      t={t}
                    />
                    <TransactionTable
                      transactions={filteredTransactions}
                      totalTransactionsCount={transactions.length}
                      setShowAddModal={setShowAddModal}
                      onEdit={handleEditClick}
                      deleteTransaction={deleteTransaction}
                      lang={lang}
                      currency={currency}
                      t={t}
                    />
                  </>
                ) : (
                  <Reports transactions={transactions} lang={lang} currency={currency} t={t} />
                )}
              </>
            )}
          </div>

          <Sidebar
            stats={stats}
            savingsGoal={savingsGoal}
            transactions={transactions}
            lang={lang}
            currency={currency}
            setShowGoalModal={setShowGoalModal}
            t={t}
          />
        </div>
      </main>

      {showAddModal && (
        <AddTransactionModal
          setShowAddModal={setShowAddModal}
          addTransaction={addTransaction}
          editTransaction={editTransaction}
          transactionToEdit={transactionToEdit}
          currency={currency}
          t={t}
        />
      )}

      {showGoalModal && (
        <SetGoalModal
          savingsGoal={savingsGoal}
          setSavingsGoal={setSavingsGoal}
          setShowGoalModal={setShowGoalModal}
          currency={currency}
          t={t}
        />
      )}
    </div>
  );
};

export default App;
