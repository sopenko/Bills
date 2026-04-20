import { useState, useMemo, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { reconcileBills } from '../utils/billMatching'
import { getPdfUrl } from '../utils/storage'
import { supabase } from '../lib/supabase'

export function ComEdBills({ bills: propBills }) {
  const [loadingPdf, setLoadingPdf] = useState(null)
  const [pdfError, setPdfError] = useState(null)
  const [isSharedView, setIsSharedView] = useState(false)
  const [sharedBills, setSharedBills] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ownerEmail, setOwnerEmail] = useState(null)
  const [addressFilter, setAddressFilter] = useState(null)

  // Check for shared access and fetch shared bills if applicable
  useEffect(() => {
    async function checkSharedAccess() {
      setLoading(true)
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        // Check if user has any shares (meaning they're a viewer)
        const { data: shares, error: sharesError } = await supabase
          .from('bill_shares')
          .select('owner_user_id, bill_filter, service_address_filter')
          .eq('shared_with_email', user.email.toLowerCase())
          .eq('bill_filter', 'comed')

        if (sharesError) {
          console.error('Error checking shares:', sharesError)
          setLoading(false)
          return
        }

        if (shares && shares.length > 0) {
          // User is a viewer - fetch owner's bills
          const ownerUserId = shares[0].owner_user_id
          const addrFilter = shares[0].service_address_filter
          setIsSharedView(true)
          setAddressFilter(addrFilter)

          // Fetch owner's bills (RLS policy allows this)
          const { data: ownerBills, error: billsError } = await supabase
            .from('bills')
            .select('*')
            .eq('user_id', ownerUserId)

          if (billsError) {
            console.error('Error fetching shared bills:', billsError)
          } else {
            // Filter invoices by address, but keep ALL bank transactions for matching
            let filteredBills = ownerBills || []
            if (addrFilter) {
              filteredBills = filteredBills.filter(b => {
                // Keep all bank transactions (they don't have service_address)
                if (b.source === 'bank_statement' || b.source === 'plaid' || b.source === 'credit_card') {
                  return true
                }
                // Filter invoices by address
                return b.service_address?.toLowerCase().includes(addrFilter.toLowerCase())
              })
            }
            setSharedBills(filteredBills)
          }

          // Get owner's email for display
          const { data: ownerData } = await supabase
            .from('bills')
            .select('user_id')
            .eq('user_id', ownerUserId)
            .limit(1)

          // We'll just show "Owner" since we can't easily get their email
          setOwnerEmail('Property Owner')
        }
      } catch (err) {
        console.error('Error in checkSharedAccess:', err)
      }
      setLoading(false)
    }

    checkSharedAccess()
  }, [])

  // Use shared bills if viewing shared data, otherwise use prop bills
  const bills = isSharedView ? (sharedBills || []) : propBills

  // Filter to only ComEd bills
  const { comedInvoices, comedTransactions } = useMemo(() => {
    const invoices = bills.filter(b =>
      b.source === 'invoice' &&
      b.name?.toLowerCase().includes('comed')
    )
    const transactions = bills.filter(b =>
      (b.source === 'bank_statement' || b.source === 'plaid' || b.source === 'credit_card') &&
      b.name?.toLowerCase().includes('comed')
    )
    return { comedInvoices: invoices, comedTransactions: transactions }
  }, [bills])

  // Run reconciliation on ComEd bills only
  const { matched } = useMemo(() => {
    return reconcileBills(comedInvoices, comedTransactions)
  }, [comedInvoices, comedTransactions])

  const handleViewPdf = async (pdfPath, billId) => {
    if (!pdfPath) {
      setPdfError('No PDF available for this bill')
      return
    }

    setLoadingPdf(billId)
    setPdfError(null)

    try {
      const url = await getPdfUrl(pdfPath)
      if (url) {
        window.open(url, '_blank')
      } else {
        setPdfError('Could not load PDF')
      }
    } catch (err) {
      console.error('Error loading PDF:', err)
      setPdfError('Error loading PDF')
    } finally {
      setLoadingPdf(null)
    }
  }

  const formatDate = (dateStr) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  const formatAmount = (amount) => {
    return `$${Number(amount).toFixed(2)}`
  }

  // Calculate totals
  const totalBilled = matched.reduce((sum, m) => sum + Number(m.bill.amount), 0)
  const totalPaid = matched.reduce((sum, m) => sum + Number(m.transaction.amount), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-600">Loading ComEd bills...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Shared View Banner */}
      {isSharedView && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <div>
            <p className="font-medium text-purple-800">Shared View</p>
            <p className="text-sm text-purple-600">You are viewing ComEd bills shared with you (read-only)</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">ComEd Electric Bills</h1>
            <p className="text-blue-100 mt-1">
              {addressFilter === '4718'
                ? '4718 S Damen Ave, Chicago, IL 60609'
                : '4437 S Wolcott Ave Unit 1, Chicago, IL 60609'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Bills Paid</p>
          <p className="text-2xl font-bold text-green-600">{matched.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Billed</p>
          <p className="text-2xl font-bold text-gray-900">{formatAmount(totalBilled)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">{formatAmount(totalPaid)}</p>
        </div>
      </div>

      {/* Error Message */}
      {pdfError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {pdfError}
          <button onClick={() => setPdfError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Matched Bills Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-green-50">
          <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Payment History
          </h2>
          <p className="text-sm text-green-600 mt-1">All paid ComEd bills with verified bank transactions</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Billing Period
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PDF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {matched.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No matched ComEd bills found
                  </td>
                </tr>
              ) : (
                matched
                  .sort((a, b) => new Date(b.bill.due_date) - new Date(a.bill.due_date))
                  .map(({ bill, transaction }) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        {bill.billing_period ? (
                          <span className="font-medium text-gray-900">{bill.billing_period}</span>
                        ) : (
                          <span className="text-gray-400 italic">Not specified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-gray-900">
                      {formatAmount(bill.amount)}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {formatDate(bill.due_date)}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {formatDate(transaction.due_date)}
                    </td>
                    <td className="px-4 py-4 font-semibold text-green-600">
                      {formatAmount(transaction.amount)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Paid
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {bill.pdf_path ? (
                        <button
                          onClick={() => handleViewPdf(bill.pdf_path, bill.id)}
                          disabled={loadingPdf === bill.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {loadingPdf === bill.id ? (
                            <>
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Loading...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View PDF
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">No PDF</span>
                      )}
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
