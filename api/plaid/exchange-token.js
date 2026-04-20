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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { public_token, institution } = req.body

  if (!public_token) {
    return res.status(400).json({ error: 'public_token is required' })
  }

  try {
    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    })

    const accessToken = exchangeResponse.data.access_token
    const itemId = exchangeResponse.data.item_id

    // Store the connection in Supabase
    const { data, error } = await supabase
      .from('bank_connections')
      .insert([
        {
          item_id: itemId,
          access_token: accessToken,
          institution_name: institution?.name || 'Unknown Bank',
          institution_id: institution?.institution_id || null,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Error saving bank connection:', error)
      return res.status(500).json({ error: 'Failed to save bank connection' })
    }

    return res.status(200).json({
      success: true,
      connection_id: data.id,
      institution_name: data.institution_name
    })
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error.message)
    return res.status(500).json({ error: 'Failed to connect bank account' })
  }
}
