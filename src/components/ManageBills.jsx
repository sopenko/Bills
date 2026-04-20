import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'

export function ManageBills({ bills, onDelete }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [sortBy, setSortBy] = useState('due_date')
  const [sortOrder, setSortOrder] = useState('desc')

  // Detect duplicates (same amount and date)
  const duplicateIds = useMemo(() => {
    const seen = new Map()
    const duplicates = new Set()

    bills.forEach(bill => {
      const key = `${bill.amount}_${bill.due_date}_${bill.name?.toLowerCase().replace(/\s+/g, '')}`
      if (seen.has(key)) {
        duplicates.add(bill.id)
        duplicates.add(seen.get(key))
      } else {
        seen.set(key, bill.id)
      }
    })

    return duplicates
  }, [bills])

  const filteredBills = useMemo(() => {
    let result = [...bills]

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(b =>
        b.name?.toLowerCase().includes(query) ||
        b.service_address?.toLowerCase().includes(query) ||
        b.notes?.toLowerCase().includes(query)
      )
    }

    // Filter by source
    if (sourceFilter !== 'all') {
      result = result.filter(b => b.source === sourceFilter)
    }

    // Filter duplicates only
    if (showDuplicatesOnly) {
      result = result.filter(b => duplicateIds.has(b.id))
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB
      if (sortBy === 'due_date') {
        valA = new Date(a.due_date)
        valB = new Date(b.due_date)
      } else if (sortBy === 'amount') {
        valA = Number(a.amount)
        valB = Number(b.amount)
      } else if (sortBy === 'name') {
        valA = a.name?.toLowerCase() || ''
        valB = b.name?.toLowerCase() || ''
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        valA = a.source || ''
        valB = b.source || ''
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    return result
  }, [bills, searchQuery, sourceFilter, showDuplicatesOnly, duplicateIds, sortBy, sortOrder])

  const handleSelectAll = () => {
    if (selectedIds.size === filteredBills.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBills.map(b => b.id)))
    }
  }

  const handleToggleSelect = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} item(s)?`)) return

    selectedIds.forEach(id => onDelete(id))
    setSelectedIds(new Set())
  }

  const handleDeleteSingle = (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    onDelete(id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'due_date' ? 'desc' : 'asc')
    }
  }

  const formatDate = (dateStr) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  const getSourceLabel = (source) => {
    switch (source) {
      case 'invoice': return 'Utility Bill'
      case 'bank_statement': return 'Bank Statement'
      case 'plaid': return 'Plaid'
      case 'credit_card': return 'Credit Card'
      default: return source || 'Manual'
    }
  }

  const getSourceColor = (source) => {
    switch (source) {
      case 'invoice': return 'bg-amber-100 text-amber-800'
      case 'bank_statement': return 'bg-blue-100 text-blue-800'
      case 'plaid': return 'bg-green-100 text-green-800'
      case 'credit_card': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Bills</p>
          <p className="text-2xl font-bold text-gray-900">{bills.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Utility Bills</p>
          <p className="text-2xl font-bold text-amber-600">
            {bills.filter(b => b.source === 'invoice').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Bank Transactions</p>
          <p className="text-2xl font-bold text-blue-600">
            {bills.filter(b => b.source === 'bank_statement' || b.source === 'plaid').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Potential Duplicates</p>
          <p className="text-2xl font-bold text-red-600">{duplicateIds.size}</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, address, notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="invoice">Utility Bills</option>
              <option value="bank_statement">Bank Statements</option>
              <option value="plaid">Plaid</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDuplicatesOnly}
                onChange={(e) => setShowDuplicatesOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Show Duplicates Only</span>
            </label>
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredBills.length && filteredBills.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('name')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
                  >
                    Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('amount')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
                  >
                    Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('due_date')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
                  >
                    Date {sortBy === 'due_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('source')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
                  >
                    Source {sortBy === 'source' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
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
                filteredBills.map(bill => (
                  <tr
                    key={bill.id}
                    className={`hover:bg-gray-50 ${duplicateIds.has(bill.id) ? 'bg-red-50' : ''} ${selectedIds.has(bill.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(bill.id)}
                        onChange={() => handleToggleSelect(bill.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {duplicateIds.has(bill.id) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title="Potential duplicate">
                            DUP
                          </span>
                        )}
                        <span className="font-medium text-gray-900">{bill.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      ${Number(bill.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(bill.due_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(bill.source)}`}>
                        {getSourceLabel(bill.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={bill.service_address}>
                      {bill.service_address || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteSingle(bill.id, bill.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with count */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          Showing {filteredBills.length} of {bills.length} bills
          {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
        </div>
      </div>
    </div>
  )
}
