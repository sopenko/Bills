import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { addMonths, format } from 'date-fns'

export function useBills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('due_date', { ascending: true })

      if (error) throw error
      setBills(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBills()
  }, [fetchBills])

  const addBill = async (bill) => {
    const { data, error } = await supabase
      .from('bills')
      .insert([bill])
      .select()
      .single()

    if (error) throw error
    setBills((prev) => [...prev, data])
    return data
  }

  const updateBill = async (id, updates) => {
    const { data, error } = await supabase
      .from('bills')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setBills((prev) => prev.map((b) => (b.id === id ? data : b)))
    return data
  }

  const deleteBill = async (id) => {
    const { error } = await supabase.from('bills').delete().eq('id', id)

    if (error) throw error
    setBills((prev) => prev.filter((b) => b.id !== id))
  }

  const markPaid = async (id) => {
    const bill = bills.find((b) => b.id === id)
    if (!bill) return

    // Update current bill to paid
    await updateBill(id, { paid: true })

    // If recurring, create next month's bill
    if (bill.type === 'recurring') {
      const nextDueDate = format(addMonths(new Date(bill.due_date), 1), 'yyyy-MM-dd')
      await addBill({
        name: bill.name,
        amount: bill.amount,
        due_date: nextDueDate,
        category: bill.category,
        type: 'recurring',
        paid: false,
        notes: bill.notes,
      })
    }
  }

  return {
    bills,
    loading,
    error,
    addBill,
    updateBill,
    deleteBill,
    markPaid,
    refetch: fetchBills,
  }
}
