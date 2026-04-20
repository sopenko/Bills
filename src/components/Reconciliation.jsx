import { useState, useMemo } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns'
import { reconcileBills, getUniqueProviders } from '../utils/billMatching'

export function Reconciliation({ bills }) {
  const [dateRange, setDateRange] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedMatches, setExpandedMatches] = useState(new Set())

  // Separate utility bills from bank transactions
  const { utilityBills, bankTransactions } = useMemo(() => {
    const utilities = bills.filter(b => b.source === 'invoice')
    const transactions = bills.filter(b =>
      b.source === 'bank_statement' ||
      b.source === 'plaid' ||
      b.source === 'credit_card'
    )
    return { utilityBills: utilities, bankTransactions: transactions }
  }, [bills])

  // Get unique providers for filter dropdown
  const providers = useMemo(() => {
    return getUniqueProviders([...utilityBills, ...bankTransactions])
  }, [utilityBills, bankTransactions])

  // Filter bills by date range
  const filterByDate = (billList) => {
    if (dateRange === 'all') return billList

    const now = new Date()
    let startDate, endDate

    switch (dateRange) {
      case 'thisMonth':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'lastMonth':
        startDate = startOfMonth(subMonths(now, 1))
        endDate = endOfMonth(subMonths(now, 1))
        break
      case 'thisQuarter':
        startDate = startOfQuarter(now)
        endDate = endOfQuarter(now)
        break
      case 'thisYear':
        startDate = startOfYear(now)
        endDate = endOfYear(now)
        break
      default:
        return billList
    }

    return billList.filter(bill => {
      const billDate = parseISO(bill.due_date)
      return billDate >= startDate && billDate <= endDate
    })
  }

  // Filter by provider
  const filterByProvider = (billList) => {
    if (providerFilter === 'all') return billList
    return billList.filter(bill =>
      bill.name?.toLowerCase().includes(providerFilter.toLowerCase())
    )
  }

  // Apply filters and run reconciliation
  const reconciliationResult = useMemo(() => {
    const filteredUtilities = filterByProvider(filterByDate(utilityBills))
    const filteredTransactions = filterByProvider(filterByDate(bankTransactions))

    return reconcileBills(filteredUtilities, filteredTransactions)
  }, [utilityBills, bankTransactions, dateRange, providerFilter])

  // Apply status filter for display
  const displayData = useMemo(() => {
    const { matched, unmatchedBills, unmatchedTransactions } = reconciliationResult

    if (statusFilter === 'matched') {
      return { matched, unmatchedBills: [], unmatchedTransactions: [] }
    }
    if (statusFilter === 'unmatched') {
      return { matched: [], unmatchedBills, unmatchedTransactions }
    }
    return reconciliationResult
  }, [reconciliationResult, statusFilter])

  const toggleExpanded = (id) => {
    setExpandedMatches(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const formatDate = (dateStr) => {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  }

  const formatAmount = (amount) => {
    return `$${Number(amount).toFixed(2)}`
  }

  const { matched, unmatchedBills, unmatchedTransactions } = displayData

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-green-600 font-medium">Matched</p>
              <p className="text-2xl font-bold text-green-700">{reconciliationResult.matched.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-amber-600 font-medium">Unmatched Bills</p>
              <p className="text-2xl font-bold text-amber-700">{reconciliationResult.unmatchedBills.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Unmatched Transactions</p>
              <p className="text-2xl font-bold text-blue-700">{reconciliationResult.unmatchedTransactions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisQuarter">This Quarter</option>
              <option value="thisYear">This Year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Providers</option>
              {providers.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="matched">Matched Only</option>
              <option value="unmatched">Unmatched Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Matched Bills Section */}
      {matched.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-green-50">
            <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Matched Bills ({matched.length})
            </h2>
            <p className="text-sm text-green-600 mt-1">
              Utility bills successfully matched to bank transactions
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {matched.map(({ bill, transaction }) => (
              <div key={bill.id} className="p-4">
                <button
                  onClick={() => toggleExpanded(bill.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{bill.name}</p>
                        {bill.billing_period && (
                          <p className="text-sm text-blue-600 font-medium">{bill.billing_period}</p>
                        )}
                        {bill.service_address && (
                          <p className="text-sm text-gray-500">{bill.service_address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-gray-900">{formatAmount(bill.amount)}</span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedMatches.has(bill.id) ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {expandedMatches.has(bill.id) && (
                  <div className="mt-4 ml-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Utility Bill Details */}
                    <div className="bg-amber-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Utility Bill
                      </h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-amber-600">Provider</dt>
                          <dd className="font-medium text-amber-900">{bill.name}</dd>
                        </div>
                        {bill.billing_period && (
                          <div className="flex justify-between">
                            <dt className="text-amber-600">Billing Period</dt>
                            <dd className="font-medium text-amber-900">{bill.billing_period}</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-amber-600">Due Date</dt>
                          <dd className="font-medium text-amber-900">{formatDate(bill.due_date)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-amber-600">Amount</dt>
                          <dd className="font-medium text-amber-900">{formatAmount(bill.amount)}</dd>
                        </div>
                        {bill.service_address && (
                          <div className="flex justify-between">
                            <dt className="text-amber-600">Service Address</dt>
                            <dd className="font-medium text-amber-900">{bill.service_address}</dd>
                          </div>
                        )}
                        {bill.source_document && (
                          <div className="flex justify-between">
                            <dt className="text-amber-600">Source</dt>
                            <dd className="font-medium text-amber-900 truncate max-w-[150px]" title={bill.source_document}>
                              {bill.source_document}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Bank Transaction Details */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Bank Transaction
                      </h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-blue-600">Description</dt>
                          <dd className="font-medium text-blue-900">{transaction.name}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-blue-600">Date</dt>
                          <dd className="font-medium text-blue-900">{formatDate(transaction.due_date)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-blue-600">Amount</dt>
                          <dd className="font-medium text-blue-900">{formatAmount(transaction.amount)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-blue-600">Source</dt>
                          <dd className="font-medium text-blue-900 capitalize">{transaction.source?.replace('_', ' ')}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched Utility Bills Section */}
      {unmatchedBills.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Unmatched Utility Bills ({unmatchedBills.length})
            </h2>
            <p className="text-sm text-amber-600 mt-1">
              Bills without a corresponding bank payment - may be unpaid or payments not yet imported
            </p>
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
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {unmatchedBills.map(bill => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{bill.name}</p>
                      {bill.source_document && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">{bill.source_document}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {bill.service_address || <span className="text-gray-400 italic">Not set</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(bill.due_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatAmount(bill.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bill.paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {bill.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched Bank Transactions Section */}
      {unmatchedTransactions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-blue-50">
            <h2 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Unmatched Bank Transactions ({unmatchedTransactions.length})
            </h2>
            <p className="text-sm text-blue-600 mt-1">
              Payments without a corresponding utility bill - may be missing bill PDFs or non-utility payments
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {unmatchedTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{tx.name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(tx.due_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatAmount(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {tx.source?.replace('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {matched.length === 0 && unmatchedBills.length === 0 && unmatchedTransactions.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No bills to reconcile</h3>
          <p className="mt-1 text-sm text-gray-500">
            Import utility bills and bank transactions to start reconciling.
          </p>
        </div>
      )}
    </div>
  )
}
