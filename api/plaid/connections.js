import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get all bank connections
    const { data, error } = await supabase
      .from('bank_connections')
      .select('id, institution_name, institution_id, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching connections:', error)
      return res.status(500).json({ error: 'Failed to fetch connections' })
    }

    return res.status(200).json({ connections: data })
  }

  if (req.method === 'DELETE') {
    const { connection_id } = req.body

    if (!connection_id) {
      return res.status(400).json({ error: 'connection_id is required' })
    }

    const { error } = await supabase
      .from('bank_connections')
      .delete()
      .eq('id', connection_id)

    if (error) {
      console.error('Error deleting connection:', error)
      return res.status(500).json({ error: 'Failed to delete connection' })
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
