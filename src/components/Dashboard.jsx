import { useMemo } from 'react'
import { isAfter, isBefore, addDays, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { reconcileBills } from '../utils/billMatching'

export function Dashboard({ bills }) {
  // Find utility bills that have matching bank transactions (considered paid)
  const matchedBillIds = useMemo(() => {
    const utilityBills = bills.filter(b => b.source === 'invoice')
    const bankTransactions = bills.filter(b =>
      b.source === 'bank_statement' || b.source === 'plaid' || b.source === 'credit_card'
    )
    const { matched } = reconcileBills(utilityBills, bankTransactions)
    return new Set(matched.map(m => m.bill.id))
  }, [bills])

  const stats = useMemo(() => {
    const today = new Date()
    const sevenDaysFromNow = addDays(today, 7)
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)

    // Consider a bill paid if it's marked paid OR has a matching bank transaction
    const isPaid = (b) => b.paid || matchedBillIds.has(b.id)

    const unpaidBills = bills.filter((b) => !isPaid(b))
    const paidBills = bills.filter((b) => isPaid(b))

    // Total unpaid amount
    const totalUnpaid = unpaidBills.reduce((sum, b) => sum + Number(b.amount), 0)

    // Overdue bills (unpaid and past due date)
    const overdueBills = unpaidBills.filter((b) => isBefore(parseISO(b.due_date), today))

    // Due in next 7 days (unpaid)
    const dueSoon = unpaidBills.filter((b) => {
      const dueDate = parseISO(b.due_date)
      return !isBefore(dueDate, today) && !isAfter(dueDate, sevenDaysFromNow)
    })
    const dueSoonAmount = dueSoon.reduce((sum, b) => sum + Number(b.amount), 0)

    // Paid this month
    const paidThisMonth = paidBills.filter((b) => {
      const dueDate = parseISO(b.due_date)
      return !isBefore(dueDate, monthStart) && !isAfter(dueDate, monthEnd)
    })
    const paidThisMonthAmount = paidThisMonth.reduce((sum, b) => sum + Number(b.amount), 0)

    return {
      totalUnpaid,
      overdueCount: overdueBills.length,
      dueSoonAmount,
      paidThisMonthAmount,
    }
  }, [bills, matchedBillIds])

  const cards = [
    {
      title: 'Total Unpaid',
      value: `$${stats.totalUnpaid.toFixed(2)}`,
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-700',
    },
    {
      title: 'Overdue Bills',
      value: stats.overdueCount,
      color: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-700',
    },
    {
      title: 'Due in 7 Days',
      value: `$${stats.dueSoonAmount.toFixed(2)}`,
      color: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-700',
    },
    {
      title: 'Paid This Month',
      value: `$${stats.paidThisMonthAmount.toFixed(2)}`,
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`p-4 rounded-lg border ${card.color}`}
        >
          <p className="text-sm text-gray-600 mb-1">{card.title}</p>
          <p className={`text-2xl font-semibold ${card.textColor}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
