import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'

const SOURCE_LABELS = {
  manual: 'Manual Entry',
  bank_statement: 'Bank Statement',
  credit_card: 'Credit Card',
  invoice: 'Invoice',
  plaid: 'Plaid (Bank API)',
}

const SOURCE_ICONS = {
  manual: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  bank_statement: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  credit_card: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  invoice: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  ),
  plaid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
}

const SOURCE_COLORS = {
  manual: 'bg-gray-100 text-gray-700 border-gray-200',
  bank_statement: 'bg-blue-50 text-blue-700 border-blue-200',
  credit_card: 'bg-purple-50 text-purple-700 border-purple-200',
  invoice: 'bg-amber-50 text-amber-700 border-amber-200',
  plaid: 'bg-green-50 text-green-700 border-green-200',
}

export function ImportHistory({ bills }) {
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('all')

  // Group bills by source_document
  const groupedData = useMemo(() => {
    const groups = new Map()

    bills.forEach((bill) => {
      const docKey = bill.source_document || `_${bill.source}_manual`
      const displayName = bill.source_document || 'Manual entries'

      if (!groups.has(docKey)) {
        groups.set(docKey, {
          key: docKey,
          name: displayName,
          source: bill.source || 'manual',
          bills: [],
          totalAmount: 0,
          earliestDate: null,
          latestDate: null,
        })
      }

      const group = groups.get(docKey)
      group.bills.push(bill)
      group.totalAmount += Number(bill.amount)

      const billDate = parseISO(bill.due_date)
      if (!group.earliestDate || billDate < group.earliestDate) {
        group.earliestDate = billDate
      }
      if (!group.latestDate || billDate > group.latestDate) {
        group.latestDate = billDate
      }
    })

    // Convert to array and sort by latest date (most recent first)
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.latestDate) return 1
      if (!b.latestDate) return -1
      return b.latestDate - a.latestDate
    })
  }, [bills])

  // Filter by source type
  const filteredGroups = useMemo(() => {
    if (sourceFilter === 'all') return groupedData
    return groupedData.filter((g) => g.source === sourceFilter)
  }, [groupedData, sourceFilter])

  // Get unique sources for filter
  const availableSources = useMemo(() => {
    const sources = new Set(groupedData.map((g) => g.source))
    return Array.from(sources)
  }, [groupedData])

  // Summary stats
  const stats = useMemo(() => {
    return {
      totalDocuments: filteredGroups.length,
      totalBills: filteredGroups.reduce((sum, g) => sum + g.bills.length, 0),
      totalAmount: filteredGroups.reduce((sum, g) => sum + g.totalAmount, 0),
    }
  }, [filteredGroups])

  const toggleExpand = (key) => {
    setExpandedDoc(expandedDoc === key ? null : key)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Import History</h2>
          <p className="text-sm text-gray-500">
            View all imported documents and their transactions
          </p>
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Sources</option>
          {availableSources.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source] || source}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Documents/Sources</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Bills</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalBills}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">${stats.totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No imported documents found
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredGroups.map((group) => (
              <div key={group.key}>
                {/* Document Header */}
                <button
                  onClick={() => toggleExpand(group.key)}
                  className={`w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left ${
                    expandedDoc === group.key ? 'bg-gray-50' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${SOURCE_COLORS[group.source] || SOURCE_COLORS.manual}`}>
                    {SOURCE_ICONS[group.source] || SOURCE_ICONS.manual}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{group.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span>{SOURCE_LABELS[group.source] || group.source}</span>
                      <span>•</span>
                      <span>{group.bills.length} bill{group.bills.length !== 1 ? 's' : ''}</span>
                      {group.earliestDate && group.latestDate && (
                        <>
                          <span>•</span>
                          <span>
                            {format(group.earliestDate, 'MMM d')} - {format(group.latestDate, 'MMM d, yyyy')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${group.totalAmount.toFixed(2)}</p>
                  </div>

                  {/* Expand Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedDoc === group.key ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded Transactions */}
                {expandedDoc === group.key && (
                  <div className="bg-gray-50 border-t border-gray-200">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-left font-medium">Category</th>
                          <th className="px-4 py-2 text-right font-medium">Amount</th>
                          <th className="px-4 py-2 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {group.bills
                          .sort((a, b) => parseISO(b.due_date) - parseISO(a.due_date))
                          .map((bill) => (
                            <tr key={bill.id} className="hover:bg-gray-100">
                              <td className="px-4 py-2">
                                <p className="text-sm font-medium text-gray-900">{bill.name}</p>
                                {bill.notes && (
                                  <p className="text-xs text-gray-500 truncate max-w-xs">{bill.notes}</p>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {format(parseISO(bill.due_date), 'MMM d, yyyy')}
                              </td>
                              <td className="px-4 py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                                  {bill.category}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                ${Number(bill.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {bill.paid ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                                    Unpaid
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
