import { useState, useEffect } from 'react'
import { format } from 'date-fns'

const CATEGORIES = ['housing', 'utilities', 'subscriptions', 'insurance', 'loan', 'other']
const TYPES = ['one-time', 'recurring']
const SOURCES = ['manual', 'bank_statement', 'credit_card', 'invoice', 'plaid']

export function BillForm({ isOpen, onClose, onSubmit, initialData, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    category: 'other',
    type: 'one-time',
    source: 'manual',
    source_document: '',
    notes: '',
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        amount: initialData.amount?.toString() || '',
        due_date: initialData.due_date || format(new Date(), 'yyyy-MM-dd'),
        category: initialData.category || 'other',
        type: initialData.type || 'one-time',
        source: initialData.source || 'manual',
        source_document: initialData.source_document || '',
        notes: initialData.notes || '',
      })
    } else {
      setFormData({
        name: '',
        amount: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        category: 'other',
        type: 'one-time',
        source: 'manual',
        source_document: '',
        notes: '',
      })
    }
  }, [initialData, isOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  if (!isOpen) return null

  const isEditing = !!initialData?.id

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Bill' : 'Add New Bill'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Bill Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Electric Bill"
              />
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount ($) *
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                required
                value={formData.due_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="capitalize">
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Type *
              </label>
              <select
                id="type"
                name="type"
                required
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'one-time' ? 'One-time' : 'Recurring'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <select
                id="source"
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual Entry</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="credit_card">Credit Card</option>
                <option value="invoice">Invoice</option>
                <option value="plaid">Plaid (Bank API)</option>
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : isEditing ? 'Update Bill' : 'Add Bill'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
