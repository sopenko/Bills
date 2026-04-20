import { useState, useRef, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { findDuplicates } from '../utils/duplicateDetection'
import { uploadPdfFromBase64 } from '../utils/storage'

const CATEGORY_COLORS = {
  housing: 'bg-blue-100 text-blue-800',
  utilities: 'bg-green-100 text-green-800',
  subscriptions: 'bg-purple-100 text-purple-800',
  insurance: 'bg-yellow-100 text-yellow-800',
  loan: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
}

export function BankStatementImport({ isOpen, onClose, onImportBills, existingBills = [], userId }) {
  const [isLoading, setIsLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [statementInfo, setStatementInfo] = useState(null)
  const [fileName, setFileName] = useState('')
  const [pdfBase64, setPdfBase64] = useState(null)
  const [step, setStep] = useState('upload') // 'upload' | 'select'
  const [showDuplicates, setShowDuplicates] = useState(true)
  const fileInputRef = useRef(null)

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

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file')
      return
    }

    setFileName(file.name)
    setIsLoading(true)

    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Store base64 for later upload
      setPdfBase64(base64)

      // Send to API
      const response = await fetch('/api/parse-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdf: base64 }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.hint || errorData.error || errorData.message || 'Failed to parse statement'
        throw new Error(errorMsg)
      }

      const data = await response.json()

      if (data.error || !data.transactions?.length) {
        toast.error(data.error || 'No transactions found in this document')
        return
      }

      // Add IDs to transactions for selection
      const transactionsWithIds = data.transactions.map((t, i) => ({
        ...t,
        id: `tx-${i}`,
      }))

      setTransactions(transactionsWithIds)
      setStatementInfo({
        period: data.statement_period,
        account: data.account_hint,
      })
      setSelectedIds(new Set(transactionsWithIds.map((t) => t.id)))
      setStep('select')
      toast.success(`Found ${transactionsWithIds.length} transactions`)
    } catch (error) {
      console.error('Error importing statement:', error)
      toast.error(error.message || 'Failed to parse bank statement')
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const toggleTransaction = (id) => {
    setSelectedIds((prev) => {
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
      setSelectedIds(new Set(transactions.map((t) => t.id)))
    }
  }

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one transaction')
      return
    }

    setIsLoading(true)
    let pdfPath = null

    // Upload PDF if we have base64 data and userId
    if (pdfBase64 && userId) {
      try {
        pdfPath = await uploadPdfFromBase64(pdfBase64, fileName, userId)
        toast.success('PDF saved to storage')
      } catch (error) {
        console.error('Failed to upload PDF:', error)
        // Continue without PDF - don't block import
      }
    }

    const selectedTransactions = transactions
      .filter((t) => selectedIds.has(t.id))
      .map((t) => ({
        name: t.name,
        amount: t.amount,
        due_date: t.date,
        category: t.category || 'other',
        type: 'one-time',
        paid: true,
        source: 'bank_statement',
        source_document: fileName,
        pdf_path: pdfPath,
        notes: t.description,
      }))

    setIsLoading(false)
    onImportBills(selectedTransactions)
    handleClose()
  }

  const handleClose = () => {
    setStep('upload')
    setTransactions([])
    setSelectedIds(new Set())
    setFileName('')
    setPdfBase64(null)
    setStatementInfo(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Import Bank Statement</h2>
              {statementInfo && (
                <p className="text-sm text-gray-500">
                  {statementInfo.period}
                  {statementInfo.account && ` • Account: ...${statementInfo.account}`}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {step === 'upload' && (
              <div className="flex flex-col items-center justify-center py-12">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="statement-upload"
                />
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Upload Bank Statement</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Upload a PDF bank statement to extract transactions
                  </p>
                  <label
                    htmlFor="statement-upload"
                    className={`mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md transition-colors cursor-pointer ${
                      isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                        <span>Extracting transactions...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        <span>Select PDF</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            )}

            {step === 'select' && (
              <div>
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
                    Total selected: $
                    {transactions
                      .filter((t) => selectedIds.has(t.id))
                      .reduce((sum, t) => sum + t.amount, 0)
                      .toFixed(2)}
                  </p>
                </div>

                <div className="space-y-2">
                  {transactions
                    .filter((tx) => showDuplicates || !duplicateMap.has(tx.id))
                    .map((tx) => {
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
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                  CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.other
                                }`}
                              >
                                {tx.category}
                              </span>
                            </div>
                            {isDuplicate && (
                              <p className="text-xs text-amber-700 mt-1">
                                Similar to: {duplicate.existingBill.name} (${Number(duplicate.existingBill.amount).toFixed(2)} on {format(parseISO(duplicate.existingBill.due_date), 'MMM d')})
                              </p>
                            )}
                            {tx.description && !isDuplicate && (
                              <p className="text-sm text-gray-500 truncate mt-1">{tx.description}</p>
                            )}
                          </div>
                          <span className="font-semibold text-gray-900">${tx.amount.toFixed(2)}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {step === 'select' && (
            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                Upload Different File
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedIds.size === 0}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
