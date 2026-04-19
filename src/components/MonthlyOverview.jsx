import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { startOfMonth, endOfMonth, parseISO, isAfter, isBefore, format } from 'date-fns'

const CATEGORY_COLORS = {
  housing: '#3B82F6',
  utilities: '#10B981',
  subscriptions: '#8B5CF6',
  insurance: '#F59E0B',
  loan: '#EF4444',
  other: '#6B7280',
}

export function MonthlyOverview({ bills }) {
  const { categoryData, paidUnpaidData, currentMonth } = useMemo(() => {
    const today = new Date()
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)

    // Filter bills for current month
    const monthlyBills = bills.filter((b) => {
      const dueDate = parseISO(b.due_date)
      return !isBefore(dueDate, monthStart) && !isAfter(dueDate, monthEnd)
    })

    // Group by category
    const byCategory = {}
    monthlyBills.forEach((bill) => {
      const cat = bill.category
      if (!byCategory[cat]) {
        byCategory[cat] = 0
      }
      byCategory[cat] += Number(bill.amount)
    })

    const categoryData = Object.entries(byCategory).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round(value * 100) / 100,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS.other,
    }))

    // Paid vs Unpaid
    const paidAmount = monthlyBills
      .filter((b) => b.paid)
      .reduce((sum, b) => sum + Number(b.amount), 0)
    const unpaidAmount = monthlyBills
      .filter((b) => !b.paid)
      .reduce((sum, b) => sum + Number(b.amount), 0)

    const paidUnpaidData = [
      { name: 'Paid', value: Math.round(paidAmount * 100) / 100, color: '#10B981' },
      { name: 'Unpaid', value: Math.round(unpaidAmount * 100) / 100, color: '#EF4444' },
    ].filter((d) => d.value > 0)

    return {
      categoryData,
      paidUnpaidData,
      currentMonth: format(today, 'MMMM yyyy'),
    }
  }, [bills])

  const totalSpending = categoryData.reduce((sum, d) => sum + d.value, 0)

  if (categoryData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Overview - {currentMonth}</h2>
        <p className="text-gray-500 text-center py-8">No bills for this month yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Monthly Overview - {currentMonth}</h2>
      <p className="text-gray-600 mb-6">Total: ${totalSpending.toFixed(2)}</p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Category Breakdown - Donut Chart */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">Spending by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {categoryData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-gray-600">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Paid vs Unpaid - Bar Chart */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">Paid vs Unpaid</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paidUnpaidData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {paidUnpaidData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {paidUnpaidData.map((entry) => (
              <div key={entry.name} className="text-center">
                <p className="text-sm text-gray-600">{entry.name}</p>
                <p className="text-lg font-semibold" style={{ color: entry.color }}>
                  ${entry.value.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
