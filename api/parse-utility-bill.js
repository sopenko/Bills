export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf, emailContent, billType } = req.body

  if (!pdf && !emailContent) {
    return res.status(400).json({ error: 'PDF or email content is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  const systemPrompt = `You are an expert at extracting billing information from utility bills and email notifications.
Extract bill details and return ONLY a valid JSON object with no extra text or markdown.

The JSON should have this structure:
{
  "name": "Company/Utility name (e.g., 'ComEd Electric', 'Peoples Gas', 'AT&T Internet')",
  "amount": number (the amount due, as a number not string),
  "due_date": "YYYY-MM-DD format",
  "category": "utilities",
  "type": "recurring",
  "notes": "Account number or any relevant details",
  "provider_type": "electric" | "gas" | "water" | "internet" | "phone" | "trash" | "sewer" | "other"
}

If a field cannot be determined, set it to null.
Always try to identify the utility provider and bill amount.
For due dates, if only a month is mentioned, use the 1st of that month.`

  try {
    let messages

    if (pdf) {
      messages = [
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
              text: `${systemPrompt}\n\nExtract the billing information from this utility bill PDF.`,
            },
          ],
        },
      ]
    } else {
      messages = [
        {
          role: 'user',
          content: `${systemPrompt}\n\nExtract the billing information from this email:\n\n${emailContent}`,
        },
      ]
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Anthropic API error:', errorData)
      return res.status(response.status).json({ error: 'Failed to process bill' })
    }

    const data = await response.json()
    const content = data.content?.[0]?.text

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' })
    }

    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleanContent)
      return res.status(200).json(parsed)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      return res.status(500).json({ error: 'Failed to parse bill data', raw: content })
    }
  } catch (error) {
    console.error('Error processing utility bill:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
