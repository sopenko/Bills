import { supabase } from '../lib/supabase'

export async function uploadPdf(file, userId) {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${userId}/${timestamp}_${safeName}`

  const { data, error } = await supabase.storage
    .from('bills')
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    console.error('Upload error:', error)
    throw error
  }

  return filePath
}

export async function uploadPdfFromBase64(base64Data, fileName, userId) {
  // Convert base64 to blob
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: 'application/pdf' })

  const timestamp = Date.now()
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${userId}/${timestamp}_${safeName}`

  const { data, error } = await supabase.storage
    .from('bills')
    .upload(filePath, blob, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    console.error('Upload error:', error)
    throw error
  }

  return filePath
}

export async function getPdfUrl(filePath) {
  const { data, error } = await supabase.storage
    .from('bills')
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error) {
    console.error('Get URL error:', error)
    return null
  }

  return data.signedUrl
}

export async function deletePdf(filePath) {
  const { error } = await supabase.storage
    .from('bills')
    .remove([filePath])

  if (error) {
    console.error('Delete error:', error)
    throw error
  }
}
