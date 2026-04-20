import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts'
import { format, parseISO, startOfMonth, subMonths, isAfter, isBefore, endOfMonth } from 'date-fns'

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6']

const CATEGORY_COLORS = {
  housing: '#3B82F6',
  utilities: '#10B981',
  subscriptions: '#8B5CF6',
  insurance: '#F59E0B',
  loan: '#EF4444',
  other: '#6B7280',
}

export function SpendingAnalysis({ bills }) {
  const [timeRange, setTimeRange] = useState('12') // months
  const [view, setView] = useState('vendor') // 'vendor' | 'category' | 'trends'
  const [searchQuery, setSearchQuery] = useState('')

  // Get bills within time range
  const timeFilteredBills = useMemo(() => {
    if (timeRange === 'all') return bills

    const months = parseInt(timeRange)
    const startDate = startOfMonth(subMonths(new Date(), months - 1))

    return bills.filter(bill => {
      const dueDate = parseISO(bill.due_date)
      return isAfter(dueDate, startDate) || format(dueDate, 'yyyy-MM') === format(startDate, 'yyyy-MM')
    })
  }, [bills, timeRange])

  // Apply search filter
  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return timeFilteredBills

    const query = searchQuery.toLowerCase()
    return timeFilteredBills.filter(bill =>
      bill.name?.toLowerCase().includes(query) ||
      bill.category?.toLowerCase().includes(query) ||
      bill.notes?.toLowerCase().includes(query) ||
      bill.source_document?.toLowerCase().includes(query)
    )
  }, [timeFilteredBills, searchQuery])

  // Group by vendor/name
  const vendorData = useMemo(() => {
    const grouped = {}
    filteredBills.forEach(bill => {
      const vendor = bill.name
      if (!grouped[vendor]) {
        grouped[vendor] = {
          name: vendor,
          total: 0,
          count: 0,
          category: bill.category,
          bills: []
        }
      }
      grouped[vendor].total += Number(bill.amount)
      grouped[vendor].count += 1
      grouped[vendor].bills.push(bill)
    })

    return Object.values(grouped)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10) // Top 10 vendors
  }, [filteredBills])

  // Group by category
  const categoryData = useMemo(() => {
    const grouped = {}
    filteredBills.forEach(bill => {
      const cat = bill.category || 'other'
      if (!grouped[cat]) {
        grouped[cat] = { name: cat, total: 0, count: 0 }
      }
      grouped[cat].total += Number(bill.amount)
      grouped[cat].count += 1
    })

    return Object.values(grouped)
      .map(item => ({
        ...item,
        name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
        color: CATEGORY_COLORS[item.name.toLowerCase()] || CATEGORY_COLORS.other
      }))
      .sort((a, b) => b.total - a.total)
  }, [filteredBills])

  // Monthly trends by category
  const monthlyTrends = useMemo(() => {
    let months
    if (timeRange === 'all') {
      // Calculate months from earliest bill to now
      if (filteredBills.length === 0) return []
      const dates = filteredBills.map(b => parseISO(b.due_date))
      const earliest = new Date(Math.min(...dates))
      const now = new Date()
      months = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1
      months = Math.min(months, 60) // Cap at 5 years for performance
    } else {
      months = parseInt(timeRange)
    }

    const data = []

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(monthStart)
      const monthLabel = format(monthStart, 'MMM yyyy')

      const monthData = { month: monthLabel }
      let total = 0

      // Get bills for this month (use filteredBills to respect search)
      const monthBills = filteredBills.filter(bill => {
        const dueDate = parseISO(bill.due_date)
        return !isBefore(dueDate, monthStart) && !isAfter(dueDate, monthEnd)
      })

      // Group by category
      const categories = ['housing', 'utilities', 'subscriptions', 'insurance', 'loan', 'other']
      categories.forEach(cat => {
        const catTotal = monthBills
          .filter(b => b.category === cat)
          .reduce((sum, b) => sum + Number(b.amount), 0)
        monthData[cat] = Math.round(catTotal * 100) / 100
        total += catTotal
      })

      monthData.total = Math.round(total * 100) / 100
      data.push(monthData)
    }

    return data
  }, [filteredBills, timeRange])

  // Vendor trends over time
  const vendorTrends = useMemo(() => {
    let months
    if (timeRange === 'all') {
      if (filteredBills.length === 0) return { data: [], vendors: [] }
      const dates = filteredBills.map(b => parseISO(b.due_date))
      const earliest = new Date(Math.min(...dates))
      const now = new Date()
      months = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1
      months = Math.min(months, 24) // Cap at 2 years for readability
    } else {
      months = parseInt(timeRange)
    }

    const topVendors = vendorData.slice(0, 5).map(v => v.name)
    const data = []

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(monthStart)
      const monthLabel = format(monthStart, months > 12 ? 'MMM yy' : 'MMM')

      const monthData = { month: monthLabel }

      topVendors.forEach(vendor => {
        const vendorTotal = filteredBills
          .filter(bill => {
            const dueDate = parseISO(bill.due_date)
            return bill.name === vendor &&
              !isBefore(dueDate, monthStart) &&
              !isAfter(dueDate, monthEnd)
          })
          .reduce((sum, b) => sum + Number(b.amount), 0)
        monthData[vendor] = Math.round(vendorTotal * 100) / 100
      })

      data.push(monthData)
    }

    return { data, vendors: topVendors }
  }, [filteredBills, timeRange, vendorData])

  const totalSpending = filteredBills.reduce((sum, b) => sum + Number(b.amount), 0)

  // Calculate months for average
  const monthsCount = useMemo(() => {
    if (timeRange === 'all') {
      if (filteredBills.length === 0) return 1
      const dates = filteredBills.map(b => parseISO(b.due_date))
      const earliest = new Date(Math.min(...dates))
      const latest = new Date(Math.max(...dates))
      const diff = (latest.getFullYear() - earliest.getFullYear()) * 12 + (latest.getMonth() - earliest.getMonth()) + 1
      return Math.max(diff, 1)
    }
    return parseInt(timeRange)
  }, [timeRange, filteredBills])

  const avgMonthly = totalSpending / monthsCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Spending Analysis</h2>
            <p className="text-sm text-gray-500">Compare bills and track spending over time</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search Bar */}
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
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 py-2 w-48 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Time Range */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="24">Last 2 years</option>
              <option value="36">Last 3 years</option>
              <option value="60">Last 5 years</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Total Spent</p>
            <p className="text-2xl font-semibold text-blue-700">${totalSpending.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Monthly Avg</p>
            <p className="text-2xl font-semibold text-green-700">${avgMonthly.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600">Unique Vendors</p>
            <p className="text-2xl font-semibold text-purple-700">{vendorData.length}</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-600">Total Bills</p>
            <p className="text-2xl font-semibold text-amber-700">{filteredBills.length}</p>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('vendor')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'vendor' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          By Vendor
        </button>
        <button
          onClick={() => setView('category')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'category' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          By Category
        </button>
        <button
          onClick={() => setView('trends')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'trends' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Monthly Trends
        </button>
      </div>

      {/* Vendor View */}
      {view === 'vendor' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Vendors Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Top Vendors by Spending</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Total']} />
                  <Bar dataKey="total" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vendor Trends */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Top 5 Vendors Over Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vendorTrends.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  {vendorTrends.vendors.map((vendor, i) => (
                    <Line
                      key={vendor}
                      type="monotone"
                      dataKey={vendor}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vendor Table */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">All Vendors</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bills</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vendorData.map((vendor) => (
                    <tr key={vendor.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{vendor.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {vendor.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{vendor.count}</td>
                      <td className="px-4 py-3 text-gray-600">${(vendor.total / vendor.count).toFixed(2)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${vendor.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Category View */}
      {view === 'category' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Category Pie Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Spending by Category</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="total"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Bar Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Category Comparison</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Summary */}
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categoryData.map((cat) => (
              <div
                key={cat.name}
                className="p-4 rounded-lg border"
                style={{ borderColor: cat.color, backgroundColor: `${cat.color}10` }}
              >
                <p className="text-sm font-medium" style={{ color: cat.color }}>{cat.name}</p>
                <p className="text-xl font-semibold text-gray-900">${cat.total.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{cat.count} bills</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends View */}
      {view === 'trends' && (
        <div className="space-y-6">
          {/* Monthly Total Trend */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Monthly Spending Total</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stacked Category Trends */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Monthly Spending by Category</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="housing" stackId="a" fill={CATEGORY_COLORS.housing} name="Housing" />
                  <Bar dataKey="utilities" stackId="a" fill={CATEGORY_COLORS.utilities} name="Utilities" />
                  <Bar dataKey="subscriptions" stackId="a" fill={CATEGORY_COLORS.subscriptions} name="Subscriptions" />
                  <Bar dataKey="insurance" stackId="a" fill={CATEGORY_COLORS.insurance} name="Insurance" />
                  <Bar dataKey="loan" stackId="a" fill={CATEGORY_COLORS.loan} name="Loan" />
                  <Bar dataKey="other" stackId="a" fill={CATEGORY_COLORS.other} name="Other" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Housing</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilities</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscriptions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Other</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {monthlyTrends.map((month) => (
                    <tr key={month.month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{month.month}</td>
                      <td className="px-4 py-3 text-gray-600">${month.housing?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-gray-600">${month.utilities?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-gray-600">${month.subscriptions?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-gray-600">${month.insurance?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-gray-600">${month.loan?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-gray-600">${month.other?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${month.total?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
