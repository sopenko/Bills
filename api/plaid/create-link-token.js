import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: 'user-' + Date.now(),
      },
      client_name: 'Bill Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    })

    return res.status(200).json({ link_token: response.data.link_token })
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error.message)
    return res.status(500).json({ error: 'Failed to create link token' })
  }
}
