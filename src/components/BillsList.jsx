import { useState, useMemo } from 'react'
import { isBefore, parseISO, format } from 'date-fns'

const CATEGORIES = ['all', 'housing', 'utilities', 'subscriptions', 'insurance', 'loan', 'other']

export function BillsList({ bills, onMarkPaid, onEdit, onDelete }) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [paidFilter, setPaidFilter] = useState('all')
  const [sortBy, setSortBy] = useState('due_date')
  const [sortOrder, setSortOrder] = useState('asc')

  const filteredBills = useMemo(() => {
    let result = [...bills]

    // Filter by category
    if (categoryFilter !== 'all') {
      result = result.filter((b) => b.category === categoryFilter)
    }

    // Filter by paid status
    if (paidFilter === 'paid') {
      result = result.filter((b) => b.paid)
    } else if (paidFilter === 'unpaid') {
      result = result.filter((b) => !b.paid)
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB
      if (sortBy === 'due_date') {
        valA = parseISO(a.due_date)
        valB = parseISO(b.due_date)
      } else {
        valA = Number(a.amount)
        valB = Number(b.amount)
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    return result
  }, [bills, categoryFilter, paidFilter, sortBy, sortOrder])

  const isOverdue = (bill) => {
    return !bill.paid && isBefore(parseISO(bill.due_date), new Date())
  }

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Bills</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600">Sort by:</span>
            <button
              onClick={() => toggleSort('due_date')}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                sortBy === 'due_date'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              Due Date {sortBy === 'due_date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => toggleSort('amount')}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                sortBy === 'amount'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredBills.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No bills found
                </td>
              </tr>
            ) : (
              filteredBills.map((bill) => (
                <tr
                  key={bill.id}
                  className={`${isOverdue(bill) ? 'bg-red-50' : ''} hover:bg-gray-50`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className={`font-medium ${isOverdue(bill) ? 'text-red-700' : 'text-gray-900'}`}>
                        {bill.name}
                      </p>
                      {bill.notes && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">{bill.notes}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">${Number(bill.amount).toFixed(2)}</td>
                  <td className={`px-4 py-3 ${isOverdue(bill) ? 'text-red-700 font-medium' : ''}`}>
                    {format(parseISO(bill.due_date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                      {bill.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{bill.type}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => !bill.paid && onMarkPaid(bill.id)}
                      disabled={bill.paid}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                        bill.paid
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
                      }`}
                    >
                      {bill.paid ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Paid
                        </>
                      ) : (
                        'Mark Paid'
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(bill)}
                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(bill.id)}
                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
