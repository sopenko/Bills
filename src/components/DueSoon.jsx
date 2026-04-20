import { useMemo } from 'react'
import { isAfter, isBefore, addDays, parseISO, format } from 'date-fns'
import { reconcileBills } from '../utils/billMatching'

export function DueSoon({ bills, onMarkPaid }) {
  // Find utility bills that have matching bank transactions (considered paid)
  const matchedBillIds = useMemo(() => {
    const utilityBills = bills.filter(b => b.source === 'invoice')
    const bankTransactions = bills.filter(b =>
      b.source === 'bank_statement' || b.source === 'plaid' || b.source === 'credit_card'
    )
    const { matched } = reconcileBills(utilityBills, bankTransactions)
    return new Set(matched.map(m => m.bill.id))
  }, [bills])

  const dueSoonBills = useMemo(() => {
    const today = new Date()
    const sevenDaysFromNow = addDays(today, 7)

    // Consider a bill paid if it's marked paid OR has a matching bank transaction
    const isPaid = (b) => b.paid || matchedBillIds.has(b.id)

    return bills
      .filter((b) => !isPaid(b))
      .filter((b) => {
        const dueDate = parseISO(b.due_date)
        return isBefore(dueDate, sevenDaysFromNow)
      })
      .sort((a, b) => parseISO(a.due_date) - parseISO(b.due_date))
  }, [bills, matchedBillIds])

  const getUrgencyColor = (dueDate) => {
    const today = new Date()
    const due = parseISO(dueDate)
    const threeDaysFromNow = addDays(today, 3)

    if (isBefore(due, today)) {
      return 'bg-red-100 border-red-300 text-red-800'
    }
    if (isBefore(due, threeDaysFromNow)) {
      return 'bg-amber-100 border-amber-300 text-amber-800'
    }
    return 'bg-green-100 border-green-300 text-green-800'
  }

  const getUrgencyLabel = (dueDate) => {
    const today = new Date()
    const due = parseISO(dueDate)
    const threeDaysFromNow = addDays(today, 3)

    if (isBefore(due, today)) {
      return 'Overdue'
    }
    if (isBefore(due, threeDaysFromNow)) {
      return 'Due Soon'
    }
    return 'Upcoming'
  }

  if (dueSoonBills.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Due Soon</h2>
        <p className="text-gray-500 text-center py-4">No bills due in the next 7 days</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Due Soon</h2>
      <div className="space-y-3">
        {dueSoonBills.map((bill) => (
          <div
            key={bill.id}
            className={`p-3 rounded-lg border ${getUrgencyColor(bill.due_date)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{bill.name}</p>
                <p className="text-sm opacity-75">
                  {format(parseISO(bill.due_date), 'MMM d, yyyy')} - {getUrgencyLabel(bill.due_date)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">${Number(bill.amount).toFixed(2)}</span>
                <button
                  onClick={() => onMarkPaid(bill.id)}
                  className="px-3 py-1 text-sm bg-white rounded border hover:bg-gray-50 transition-colors"
                >
                  Mark Paid
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
