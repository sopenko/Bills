export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf } = req.body

  if (!pdf) {
    return res.status(400).json({ error: 'PDF data is required' })
  }

  // Check PDF size (base64 is ~33% larger than binary)
  const pdfSizeBytes = Math.ceil((pdf.length * 3) / 4)
  const pdfSizeMB = pdfSizeBytes / (1024 * 1024)
  console.log(`PDF size: ${pdfSizeMB.toFixed(2)} MB`)

  if (pdfSizeMB > 20) {
    return res.status(400).json({ error: `PDF too large (${pdfSizeMB.toFixed(1)} MB). Max size is 20 MB.` })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not found in environment')
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  try {
    console.log('Calling Anthropic API...')
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        system: 'You are a JSON extraction API. You ONLY output valid JSON, never any other text.',
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
                text: `Extract transactions from this statement as JSON.

Format: {"transactions":[{"name":"merchant","amount":123.45,"date":"YYYY-MM-DD","category":"other","description":null}],"statement_period":"Month Year","account_hint":"1234"}

Categories: housing, utilities, subscriptions, insurance, loan, other
- Only debits/charges (skip deposits)
- amount = positive number
- date = YYYY-MM-DD

If not a statement: {"error":"Not a bank statement","transactions":[]}`,
              },
            ],
          },
          {
            role: 'assistant',
            content: '{'
          }
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', response.status, errorText)

      let errorMessage = 'Failed to process statement'
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch (e) {
        // Use default error message
      }

      return res.status(response.status).json({
        error: errorMessage,
        status: response.status
      })
    }

    console.log('Anthropic API responded successfully')

    const data = await response.json()
    let content = data.content?.[0]?.text

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' })
    }

    // Prepend the '{' we used as prefill
    content = '{' + content

    // Try to parse the JSON response
    try {
      // Remove any markdown code blocks if present
      let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

      // Try to find JSON object in the response if direct parse fails
      let parsed
      try {
        parsed = JSON.parse(cleanContent)
      } catch (e) {
        // Try to extract JSON from the response
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      }

      return res.status(200).json(parsed)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      console.error('Parse error:', parseError.message)

      // Return a more helpful error with a snippet of the response
      const snippet = content.substring(0, 500)
      return res.status(500).json({
        error: 'Failed to parse statement data',
        hint: 'The AI response was not valid JSON',
        snippet: snippet
      })
    }
  } catch (error) {
    console.error('Error processing statement:', error.message, error.stack)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}
