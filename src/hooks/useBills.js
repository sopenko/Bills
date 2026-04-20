import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { addMonths, format } from 'date-fns'

export function useBills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)

  // Get current user ID
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchBills = useCallback(async () => {
    if (!userId) {
      setBills([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
        .limit(10000)

      if (error) throw error
      setBills(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchBills()
  }, [fetchBills])

  const addBill = async (bill) => {
    if (!userId) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('bills')
      .insert([{ ...bill, user_id: userId }])
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
        source: bill.source,
        source_document: bill.source_document,
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
