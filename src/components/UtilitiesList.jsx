import { useState, useMemo } from 'react'
import { isBefore, parseISO, format } from 'date-fns'

export function UtilitiesList({ bills, onMarkPaid, onEdit, onDelete, onUpdate }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [paidFilter, setPaidFilter] = useState('all')
  const [sortBy, setSortBy] = useState('due_date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
  const [showMissingAddress, setShowMissingAddress] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [editingAddressValue, setEditingAddressValue] = useState('')

  // Detect potential duplicates (same provider name in same month)
  const duplicateInfo = useMemo(() => {
    const monthlyBills = new Map()

    bills.forEach((bill) => {
      // Normalize the provider name more aggressively
      const normalizedName = bill.name
        ?.toLowerCase()
        .replace(/\s*(payments?|bill|charge|inc|llc|co|corp|ach|electronic|debit)\.?\s*/gi, '')
        .trim() || ''

      const monthKey = format(parseISO(bill.due_date), 'yyyy-MM')
      const key = `${normalizedName}__${monthKey}`

      if (!monthlyBills.has(key)) {
        monthlyBills.set(key, [])
      }
      monthlyBills.get(key).push(bill)
    })

    // Find duplicates (more than one bill per provider per month)
    const duplicates = new Map()
    const duplicateBillIds = new Set()

    monthlyBills.forEach((billGroup, key) => {
      if (billGroup.length > 1) {
        duplicates.set(key, billGroup)
        billGroup.forEach(b => duplicateBillIds.add(b.id))
      }
    })

    return { duplicates, duplicateBillIds }
  }, [bills])

  // Bills missing service address
  const billsMissingAddress = useMemo(() => {
    return bills.filter(b => !b.service_address || b.service_address.trim() === '')
  }, [bills])

  const filteredBills = useMemo(() => {
    let result = [...bills]

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((b) =>
        b.name?.toLowerCase().includes(query) ||
        b.notes?.toLowerCase().includes(query) ||
        b.service_address?.toLowerCase().includes(query)
      )
    }

    // Filter by paid status
    if (paidFilter === 'paid') {
      result = result.filter((b) => b.paid)
    } else if (paidFilter === 'unpaid') {
      result = result.filter((b) => !b.paid)
    }

    // Filter to show only duplicates
    if (showDuplicatesOnly) {
      result = result.filter((b) => duplicateInfo.duplicateBillIds.has(b.id))
    }

    // Filter to show only missing address
    if (showMissingAddress) {
      result = result.filter((b) => !b.service_address || b.service_address.trim() === '')
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB
      if (sortBy === 'due_date') {
        valA = parseISO(a.due_date)
        valB = parseISO(b.due_date)
      } else if (sortBy === 'name') {
        valA = a.name?.toLowerCase() || ''
        valB = b.name?.toLowerCase() || ''
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else if (sortBy === 'address') {
        valA = a.service_address?.toLowerCase() || 'zzz'
        valB = b.service_address?.toLowerCase() || 'zzz'
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        valA = Number(a.amount)
        valB = Number(b.amount)
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    return result
  }, [bills, searchQuery, paidFilter, sortBy, sortOrder, showDuplicatesOnly, showMissingAddress, duplicateInfo])

  const isOverdue = (bill) => {
    return !bill.paid && isBefore(parseISO(bill.due_date), new Date())
  }

  const isDuplicate = (bill) => {
    return duplicateInfo.duplicateBillIds.has(bill.id)
  }

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'due_date' ? 'desc' : 'asc')
    }
  }

  const handleStartEditAddress = (bill) => {
    setEditingAddressId(bill.id)
    setEditingAddressValue(bill.service_address || '')
  }

  const handleSaveAddress = async (billId) => {
    if (onUpdate) {
      await onUpdate(billId, { service_address: editingAddressValue })
    }
    setEditingAddressId(null)
    setEditingAddressValue('')
  }

  const handleCancelEditAddress = () => {
    setEditingAddressId(null)
    setEditingAddressValue('')
  }

  // Group duplicates for the alert
  const duplicateGroups = useMemo(() => {
    const groups = []
    duplicateInfo.duplicates.forEach((billGroup, key) => {
      const [name, monthKey] = key.split('__')
      const month = format(parseISO(monthKey + '-01'), 'MMMM yyyy')
      const totalAmount = billGroup.reduce((sum, b) => sum + Number(b.amount), 0)
      const addresses = billGroup.map(b => b.service_address).filter(Boolean)
      const uniqueAddresses = [...new Set(addresses)]
      groups.push({
        name: billGroup[0].name,
        month,
        count: billGroup.length,
        totalAmount,
        bills: billGroup,
        addresses: uniqueAddresses,
        missingAddresses: billGroup.filter(b => !b.service_address).length,
      })
    })
    return groups.sort((a, b) => {
      // Sort by most recent month first
      const [, monthA] = groups.find(g => g === a) ? a.month : ''
      const [, monthB] = groups.find(g => g === b) ? b.month : ''
      return monthB.localeCompare(monthA)
    })
  }, [duplicateInfo])

  return (
    <div className="space-y-4">
      {/* Missing Address Warning */}
      {billsMissingAddress.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-medium text-blue-800">{billsMissingAddress.length} bills missing service address</h3>
              <p className="text-sm text-blue-700 mt-1">
                Add service addresses to identify which property each bill belongs to.
              </p>
              <button
                onClick={() => {
                  setShowMissingAddress(!showMissingAddress)
                  setShowDuplicatesOnly(false)
                }}
                className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-900 underline"
              >
                {showMissingAddress ? 'Show all bills' : 'Show bills missing address'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Alert */}
      {duplicateGroups.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-medium text-amber-800">Multiple Charges Detected - Same Provider, Same Month</h3>
              <p className="text-sm text-amber-700 mt-1">
                These may be for different service addresses. Click to add addresses if missing.
              </p>
              <ul className="mt-2 space-y-2">
                {duplicateGroups.slice(0, 5).map((group, idx) => (
                  <li key={idx} className="text-sm text-amber-800 bg-amber-100/50 rounded p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{group.name}</span>
                        <span className="text-amber-600 mx-2">•</span>
                        <span>{group.month}</span>
                      </div>
                      <span className="font-medium">${group.totalAmount.toFixed(2)} ({group.count} charges)</span>
                    </div>
                    <div className="mt-1 text-xs">
                      {group.bills.map((bill, i) => (
                        <div key={bill.id} className="flex items-center gap-2 mt-1">
                          <span className="text-amber-700">${Number(bill.amount).toFixed(2)}</span>
                          <span className="text-amber-500">→</span>
                          {bill.service_address ? (
                            <span className="text-green-700">{bill.service_address}</span>
                          ) : (
                            <span className="text-red-600 italic">No address set</span>
                          )}
                          <span className="text-amber-400 text-xs">({bill.source_document || 'manual'})</span>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {duplicateGroups.length > 5 && (
                <p className="text-sm text-amber-600 mt-2">
                  And {duplicateGroups.length - 5} more...
                </p>
              )}
              <button
                onClick={() => {
                  setShowDuplicatesOnly(!showDuplicatesOnly)
                  setShowMissingAddress(false)
                }}
                className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900 underline"
              >
                {showDuplicatesOnly ? 'Show all utilities' : 'Show only duplicates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Utility Bills
              {showDuplicatesOnly && <span className="ml-2 text-sm font-normal text-amber-600">(Duplicates only)</span>}
              {showMissingAddress && <span className="ml-2 text-sm font-normal text-blue-600">(Missing address)</span>}
            </h2>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search utilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-64 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
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
              <span className="text-sm text-gray-600">Sort:</span>
              <button
                onClick={() => toggleSort('due_date')}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  sortBy === 'due_date'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Date {sortBy === 'due_date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => toggleSort('name')}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  sortBy === 'name'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Provider {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => toggleSort('address')}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  sortBy === 'address'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Address {sortBy === 'address' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
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
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No utility bills found
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className={`${isOverdue(bill) ? 'bg-red-50' : isDuplicate(bill) ? 'bg-amber-50' : ''} hover:bg-gray-50`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {isDuplicate(bill) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Multiple charges this month">
                            !
                          </span>
                        )}
                        <div>
                          <p className={`font-medium ${isOverdue(bill) ? 'text-red-700' : 'text-gray-900'}`}>
                            {bill.name}
                          </p>
                          {bill.source_document && (
                            <p className="text-xs text-blue-600 truncate max-w-xs" title={bill.source_document}>
                              📄 {bill.source_document}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingAddressId === bill.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingAddressValue}
                            onChange={(e) => setEditingAddressValue(e.target.value)}
                            placeholder="Enter address..."
                            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAddress(bill.id)
                              if (e.key === 'Escape') handleCancelEditAddress()
                            }}
                          />
                          <button
                            onClick={() => handleSaveAddress(bill.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Save"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelEditAddress}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditAddress(bill)}
                          className={`text-left text-sm ${
                            bill.service_address
                              ? 'text-gray-900 hover:text-blue-600'
                              : 'text-gray-400 italic hover:text-blue-600'
                          }`}
                          title="Click to edit address"
                        >
                          {bill.service_address || '+ Add address'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">${Number(bill.amount).toFixed(2)}</td>
                    <td className={`px-4 py-3 ${isOverdue(bill) ? 'text-red-700 font-medium' : ''}`}>
                      {format(parseISO(bill.due_date), 'MMM d, yyyy')}
                    </td>
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
    </div>
  )
}
