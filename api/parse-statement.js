export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf } = req.body

  if (!pdf) {
    return res.status(400).json({ error: 'PDF data is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdf,
                },
              },
              {
                type: 'text',
                text: `Extract all transactions/charges from this bank statement and return ONLY a valid JSON object with no extra text or markdown.

Return format:
{
  "transactions": [
    {
      "name": "merchant or payee name",
      "amount": number (positive for charges/debits, use absolute value),
      "date": "YYYY-MM-DD",
      "category": "housing" | "utilities" | "subscriptions" | "insurance" | "loan" | "other",
      "description": "brief description or null"
    }
  ],
  "statement_period": "Month Year or date range",
  "account_hint": "last 4 digits or account type if visible"
}

Category guidelines:
- housing: rent, mortgage, HOA fees
- utilities: electric, gas, water, internet, phone
- subscriptions: streaming services, software, memberships
- insurance: health, auto, home, life insurance
- loan: credit card payments, car loans, student loans, personal loans
- other: groceries, shopping, dining, entertainment, etc.

Only include outgoing payments/charges (debits). Skip deposits/credits.
If the document is not a bank statement, return { "error": "Not a bank statement", "transactions": [] }`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Anthropic API error:', errorData)
      return res.status(response.status).json({ error: 'Failed to process statement' })
    }

    const data = await response.json()
    const content = data.content?.[0]?.text

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' })
    }

    // Try to parse the JSON response
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleanContent)
      return res.status(200).json(parsed)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      return res.status(500).json({ error: 'Failed to parse statement data', raw: content })
    }
  } catch (error) {
    console.error('Error processing statement:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
