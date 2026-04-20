import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { createClient } from '@supabase/supabase-js'

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
})

const plaidClient = new PlaidApi(configuration)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// Map Plaid categories to our categories
function mapCategory(plaidCategory) {
  if (!plaidCategory || !plaidCategory.length) return 'other'

  const primary = plaidCategory[0]?.toLowerCase() || ''

  if (primary.includes('rent') || primary.includes('mortgage') || primary.includes('real estate')) {
    return 'housing'
  }
  if (primary.includes('utilities') || primary.includes('telecom') || primary.includes('internet')) {
    return 'utilities'
  }
  if (primary.includes('subscription') || primary.includes('streaming') || primary.includes('membership')) {
    return 'subscriptions'
  }
  if (primary.includes('insurance')) {
    return 'insurance'
  }
  if (primary.includes('loan') || primary.includes('credit') || primary.includes('payment')) {
    return 'loan'
  }

  return 'other'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { connection_id, start_date, end_date } = req.body

  try {
    // Get the access token from Supabase
    const { data: connection, error: connError } = await supabase
      .from('bank_connections')
      .select('access_token, institution_name')
      .eq('id', connection_id)
      .single()

    if (connError || !connection) {
      return res.status(404).json({ error: 'Bank connection not found' })
    }

    // Calculate date range (default: last 30 days)
    const endDate = end_date || new Date().toISOString().split('T')[0]
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Fetch transactions from Plaid
    const response = await plaidClient.transactionsGet({
      access_token: connection.access_token,
      start_date: startDate,
      end_date: endDate,
    })

    // Transform transactions to our format
    const transactions = response.data.transactions
      .filter(tx => tx.amount > 0) // Only debits (positive amounts in Plaid are debits)
      .map(tx => ({
        name: tx.merchant_name || tx.name,
        amount: Math.abs(tx.amount),
        date: tx.date,
        category: mapCategory(tx.category),
        description: tx.name,
        plaid_transaction_id: tx.transaction_id,
      }))

    return res.status(200).json({
      transactions,
      institution_name: connection.institution_name,
      accounts: response.data.accounts.map(acc => ({
        id: acc.account_id,
        name: acc.name,
        type: acc.type,
        mask: acc.mask,
      })),
    })
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error.message)
    return res.status(500).json({ error: 'Failed to fetch transactions' })
  }
}
