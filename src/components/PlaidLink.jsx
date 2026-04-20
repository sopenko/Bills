import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { findDuplicates } from '../utils/duplicateDetection'

const CATEGORY_COLORS = {
  housing: 'bg-blue-100 text-blue-800',
  utilities: 'bg-green-100 text-green-800',
  subscriptions: 'bg-purple-100 text-purple-800',
  insurance: 'bg-yellow-100 text-yellow-800',
  loan: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
}

export function PlaidLinkButton({ onTransactionsImported }) {
  const [linkToken, setLinkToken] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Get link token on mount
  useEffect(() => {
    const createLinkToken = async () => {
      try {
        const response = await fetch('/api/plaid/create-link-token', {
          method: 'POST',
        })
        const data = await response.json()
        if (data.link_token) {
          setLinkToken(data.link_token)
        }
      } catch (error) {
        console.error('Error creating link token:', error)
      }
    }
    createLinkToken()
  }, [])

  const onSuccess = useCallback(async (public_token, metadata) => {
    setIsLoading(true)
    try {
      // Exchange public token for access token
      const exchangeResponse = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token,
          institution: metadata.institution,
        }),
      })

      const exchangeData = await exchangeResponse.json()

      if (exchangeData.success) {
        toast.success(`Connected to ${exchangeData.institution_name}`)
        // Optionally fetch transactions immediately
        if (onTransactionsImported) {
          onTransactionsImported(exchangeData.connection_id)
        }
      } else {
        toast.error('Failed to connect bank account')
      }
    } catch (error) {
      console.error('Error connecting bank:', error)
      toast.error('Failed to connect bank account')
    } finally {
      setIsLoading(false)
    }
  }, [onTransactionsImported])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  })

  return (
    <button
      onClick={() => open()}
      disabled={!ready || isLoading}
      className="inline-flex items-center gap-2 px-3 py-2 border border-green-600 text-green-700 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span className="hidden sm:inline">Connect Bank</span>
        </>
      )}
    </button>
  )
}

export function BankTransactionsModal({ isOpen, onClose, onImportBills, connectionId, existingBills = [] }) {
  const [transactions, setTransactions] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [institutionName, setInstitutionName] = useState('')
  const [showDuplicates, setShowDuplicates] = useState(true)

  // Check for duplicates
  const duplicateMap = useMemo(() => {
    if (transactions.length === 0 || existingBills.length === 0) return new Map()

    const billsForCheck = transactions.map(t => ({
      name: t.name,
      amount: t.amount,
      due_date: t.date,
    }))

    const results = findDuplicates(billsForCheck, existingBills)
    const map = new Map()

    results.forEach((result, index) => {
      if (result.duplicate) {
        map.set(transactions[index].id, result.duplicate)
      }
    })

    return map
  }, [transactions, existingBills])

  const duplicateCount = duplicateMap.size

  useEffect(() => {
    if (isOpen && connectionId) {
      fetchTransactions()
    }
  }, [isOpen, connectionId])

  const fetchTransactions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/plaid/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId }),
      })

      const data = await response.json()

      if (data.transactions) {
        const txWithIds = data.transactions.map((t, i) => ({ ...t, id: `tx-${i}` }))
        setTransactions(txWithIds)
        setSelectedIds(new Set(txWithIds.map(t => t.id)))
        setInstitutionName(data.institution_name)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error('Failed to fetch transactions')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTransaction = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)))
    }
  }

  const handleImport = () => {
    const selectedTransactions = transactions
      .filter(t => selectedIds.has(t.id))
      .map(t => ({
        name: t.name,
        amount: t.amount,
        due_date: t.date,
        category: t.category || 'other',
        type: 'one-time',
        paid: true,
        source: 'plaid',
        source_document: institutionName,
        notes: t.description,
      }))

    if (selectedTransactions.length === 0) {
      toast.error('Please select at least one transaction')
      return
    }

    onImportBills(selectedTransactions)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Import from {institutionName}</h2>
              <p className="text-sm text-gray-500">Last 30 days of transactions</p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No transactions found</p>
            ) : (
              <>
                {duplicateCount > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm font-medium text-amber-800">
                          {duplicateCount} potential duplicate{duplicateCount !== 1 ? 's' : ''} detected
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showDuplicates}
                          onChange={(e) => setShowDuplicates(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                        />
                        <span className="text-sm text-amber-700">Show duplicates</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === transactions.length}
                      onChange={toggleAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select all ({selectedIds.size} of {transactions.length})
                    </span>
                  </label>
                  <p className="text-sm text-gray-500">
                    Total: ${transactions.filter(t => selectedIds.has(t.id)).reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                  </p>
                </div>

                <div className="space-y-2">
                  {transactions
                    .filter((tx) => showDuplicates || !duplicateMap.has(tx.id))
                    .map(tx => {
                      const duplicate = duplicateMap.get(tx.id)
                      const isDuplicate = !!duplicate

                      return (
                        <label
                          key={tx.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isDuplicate
                              ? 'bg-amber-50 border-amber-200'
                              : selectedIds.has(tx.id)
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(tx.id)}
                            onChange={() => toggleTransaction(tx.id)}
                            className={`w-4 h-4 rounded focus:ring-blue-500 ${
                              isDuplicate ? 'text-amber-600' : 'text-blue-600'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 truncate">{tx.name}</p>
                              {isDuplicate && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  Duplicate?
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-500">
                                {format(parseISO(tx.date), 'MMM d, yyyy')}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.other}`}>
                                {tx.category}
                              </span>
                            </div>
                            {isDuplicate && (
                              <p className="text-xs text-amber-700 mt-1">
                                Similar to: {duplicate.existingBill.name} (${Number(duplicate.existingBill.amount).toFixed(2)} on {format(parseISO(duplicate.existingBill.due_date), 'MMM d')})
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-gray-900">${tx.amount.toFixed(2)}</span>
                        </label>
                      )
                    })}
                </div>
              </>
            )}
          </div>

          {transactions.length > 0 && (
            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedIds.size === 0}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Import {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
