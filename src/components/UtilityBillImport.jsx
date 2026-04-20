import { useState, useRef } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const PROVIDER_ICONS = {
  electric: '⚡',
  gas: '🔥',
  water: '💧',
  internet: '🌐',
  phone: '📱',
  trash: '🗑️',
  sewer: '🚰',
  other: '📄',
}

export function UtilityBillImport({ isOpen, onClose, onImportBill }) {
  const [activeTab, setActiveTab] = useState('pdf')
  const [isLoading, setIsLoading] = useState(false)
  const [emailContent, setEmailContent] = useState('')
  const [extractedBill, setExtractedBill] = useState(null)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef(null)

  const resetState = () => {
    setExtractedBill(null)
    setEmailContent('')
    setFileName('')
    setIsLoading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

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

      const response = await fetch('/api/parse-utility-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: base64 }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse bill')
      }

      const data = await response.json()
      setExtractedBill({ ...data, source_document: file.name })
      toast.success('Bill data extracted!')
    } catch (error) {
      console.error('Error parsing PDF:', error)
      toast.error('Could not extract bill data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailParse = async () => {
    if (!emailContent.trim()) {
      toast.error('Please paste email content')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/parse-utility-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse email')
      }

      const data = await response.json()
      setExtractedBill({ ...data, source_document: 'Email import' })
      toast.success('Bill data extracted!')
    } catch (error) {
      console.error('Error parsing email:', error)
      toast.error('Could not extract bill data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmImport = () => {
    if (!extractedBill) return

    // Build notes with service address and account info
    const noteParts = []
    if (extractedBill.service_address) noteParts.push(`Service: ${extractedBill.service_address}`)
    if (extractedBill.account_number) noteParts.push(`Account: ${extractedBill.account_number}`)
    if (extractedBill.statement_date) noteParts.push(`Statement: ${extractedBill.statement_date}`)
    if (extractedBill.notes) noteParts.push(extractedBill.notes)

    const billData = {
      name: extractedBill.name || 'Utility Bill',
      amount: extractedBill.amount || 0,
      due_date: extractedBill.due_date || format(new Date(), 'yyyy-MM-dd'),
      category: 'utilities',
      type: 'recurring',
      paid: false,
      notes: noteParts.join(' | ') || '',
      source: 'invoice',
      source_document: extractedBill.source_document,
    }

    onImportBill(billData)
    toast.success('Utility bill imported!')
    handleClose()
  }

  const handleFieldChange = (field, value) => {
    setExtractedBill((prev) => ({ ...prev, [field]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Import Utility Bill</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!extractedBill ? (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setActiveTab('pdf')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    activeTab === 'pdf'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF Bill
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('email')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    activeTab === 'email'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </span>
                </button>
              </div>

              {/* PDF Upload */}
              {activeTab === 'pdf' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Upload a PDF of your utility bill (electric, gas, water, internet, etc.)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="utility-pdf-upload"
                  />
                  <label
                    htmlFor="utility-pdf-upload"
                    className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      isLoading
                        ? 'border-gray-300 bg-gray-50'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex flex-col items-center">
                        <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm text-gray-600">Extracting bill data...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Click to upload PDF</span>
                        <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
                      </div>
                    )}
                  </label>
                </div>
              )}

              {/* Email Content */}
              {activeTab === 'email' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Paste the content of your utility bill email notification
                  </p>
                  <textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="Paste your email content here...

Example:
Your ComEd bill is ready.
Amount Due: $85.42
Due Date: May 15, 2026
Account: ****1234"
                    className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={handleEmailParse}
                    disabled={isLoading || !emailContent.trim()}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      isLoading || !emailContent.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Extracting...
                      </span>
                    ) : (
                      'Extract Bill Data'
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Preview & Edit */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <span className="text-2xl">{PROVIDER_ICONS[extractedBill.provider_type] || PROVIDER_ICONS.other}</span>
                <div>
                  <p className="font-medium text-green-800">Bill data extracted!</p>
                  <p className="text-sm text-green-600">Review and edit if needed</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
                  <input
                    type="text"
                    value={extractedBill.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount Due</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={extractedBill.amount || ''}
                        onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={extractedBill.due_date || ''}
                      onChange={(e) => handleFieldChange('due_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statement Date</label>
                    <input
                      type="date"
                      value={extractedBill.statement_date || ''}
                      onChange={(e) => handleFieldChange('statement_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={extractedBill.account_number || ''}
                      onChange={(e) => handleFieldChange('account_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Address</label>
                  <input
                    type="text"
                    value={extractedBill.service_address || ''}
                    onChange={(e) => handleFieldChange('service_address', e.target.value)}
                    placeholder="Address where service is provided"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                  <input
                    type="text"
                    value={extractedBill.notes || ''}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    placeholder="Usage, previous balance, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {extractedBill.source_document && (
                  <p className="text-xs text-gray-500">
                    Source: {extractedBill.source_document}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {extractedBill && (
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={resetState}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={handleConfirmImport}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Import Bill
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
