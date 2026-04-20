import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './components/Login'
import { useBills } from './hooks/useBills'
import { Dashboard } from './components/Dashboard'
import { DueSoon } from './components/DueSoon'
import { BillsList } from './components/BillsList'
import { BillForm } from './components/BillForm'
import { MonthlyOverview } from './components/MonthlyOverview'
import { SpendingAnalysis } from './components/SpendingAnalysis'
import { ImportHistory } from './components/ImportHistory'
import { PdfImport } from './components/PdfImport'
import { BankStatementImport } from './components/BankStatementImport'
import { PlaidLinkButton, BankTransactionsModal } from './components/PlaidLink'
import { UtilityBillImport } from './components/UtilityBillImport'

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { bills, loading, error, addBill, updateBill, deleteBill, markPaid } = useBills()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBill, setEditingBill] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStatementImportOpen, setIsStatementImportOpen] = useState(false)
  const [isUtilityImportOpen, setIsUtilityImportOpen] = useState(false)
  const [plaidConnectionId, setPlaidConnectionId] = useState(null)
  const [isPlaidModalOpen, setIsPlaidModalOpen] = useState(false)

  const handleAddBill = () => {
    setEditingBill(null)
    setIsFormOpen(true)
  }

  const handleEditBill = (bill) => {
    setEditingBill(bill)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingBill(null)
  }

  const handleSubmitBill = async (data) => {
    setIsSubmitting(true)
    try {
      if (editingBill?.id) {
        await updateBill(editingBill.id, data)
        toast.success('Bill updated successfully')
      } else {
        await addBill(data)
        toast.success('Bill added successfully')
      }
      handleCloseForm()
    } catch (err) {
      toast.error(err.message || 'Failed to save bill')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBill = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return
    try {
      await deleteBill(id)
      toast.success('Bill deleted successfully')
    } catch (err) {
      toast.error(err.message || 'Failed to delete bill')
    }
  }

  const handleMarkPaid = async (id) => {
    try {
      await markPaid(id)
      toast.success('Bill marked as paid')
    } catch (err) {
      toast.error(err.message || 'Failed to update bill')
    }
  }

  const handlePdfImport = (data) => {
    setEditingBill(data)
    setIsFormOpen(true)
  }

  const handleStatementImport = async (transactions) => {
    let successCount = 0
    let failCount = 0

    for (const tx of transactions) {
      try {
        await addBill(tx)
        successCount++
      } catch (err) {
        console.error('Failed to add bill:', err)
        failCount++
      }
    }

    if (successCount > 0) {
      toast.success(`Imported ${successCount} bill${successCount !== 1 ? 's' : ''}`)
    }
    if (failCount > 0) {
      toast.error(`Failed to import ${failCount} transaction${failCount !== 1 ? 's' : ''}`)
    }
  }

  const handlePlaidConnected = (connectionId) => {
    setPlaidConnectionId(connectionId)
    setIsPlaidModalOpen(true)
  }

  const handleUtilityBillImport = async (billData) => {
    try {
      await addBill(billData)
    } catch (err) {
      toast.error(err.message || 'Failed to import utility bill')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch (err) {
      toast.error(err.message || 'Failed to sign out')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-600">{authLoading ? 'Loading...' : 'Loading bills...'}</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <p className="text-gray-600">Please check your Supabase configuration.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">Bill Tracker</h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <PlaidLinkButton onTransactionsImported={handlePlaidConnected} />
              <PdfImport onImportComplete={handlePdfImport} />
              <button
                onClick={() => setIsUtilityImportOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="hidden sm:inline">Utility Bill</span>
              </button>
              <button
                onClick={() => setIsStatementImportOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Statement PDF</span>
              </button>
              <button
                onClick={handleAddBill}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Bill</span>
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title={user.email}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'bills'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Bills
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'monthly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Monthly Overview
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('imports')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'imports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Imports
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <Dashboard bills={bills} />
            <DueSoon bills={bills} onMarkPaid={handleMarkPaid} />
          </div>
        )}

        {activeTab === 'bills' && (
          <BillsList
            bills={bills}
            onMarkPaid={handleMarkPaid}
            onEdit={handleEditBill}
            onDelete={handleDeleteBill}
          />
        )}

        {activeTab === 'monthly' && <MonthlyOverview bills={bills} />}

        {activeTab === 'analytics' && <SpendingAnalysis bills={bills} />}

        {activeTab === 'imports' && <ImportHistory bills={bills} />}
      </main>

      {/* Bill Form Modal */}
      <BillForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmitBill}
        initialData={editingBill}
        isLoading={isSubmitting}
      />

      {/* Bank Statement Import Modal */}
      <BankStatementImport
        isOpen={isStatementImportOpen}
        onClose={() => setIsStatementImportOpen(false)}
        onImportBills={handleStatementImport}
        existingBills={bills}
      />

      {/* Plaid Bank Transactions Modal */}
      <BankTransactionsModal
        isOpen={isPlaidModalOpen}
        onClose={() => setIsPlaidModalOpen(false)}
        onImportBills={handleStatementImport}
        connectionId={plaidConnectionId}
        existingBills={bills}
      />

      {/* Utility Bill Import Modal */}
      <UtilityBillImport
        isOpen={isUtilityImportOpen}
        onClose={() => setIsUtilityImportOpen(false)}
        onImportBill={handleUtilityBillImport}
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
