import { useState, useRef } from 'react'
import toast from 'react-hot-toast'

export function PdfImport({ onImportComplete }) {
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file')
      return
    }

    setIsLoading(true)

    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          // Remove data URL prefix (data:application/pdf;base64,)
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Send to API
      const response = await fetch('/api/parse-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdf: base64 }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse invoice')
      }

      const data = await response.json()

      // Check if we got valid data
      const hasValidData = data.name || data.amount || data.due_date

      if (hasValidData) {
        toast.success('Invoice data extracted successfully')
        onImportComplete(data)
      } else {
        toast.error('Could not extract all fields — please fill in manually')
        onImportComplete({})
      }
    } catch (error) {
      console.error('Error importing invoice:', error)
      toast.error('Could not extract all fields — please fill in manually')
      onImportComplete({})
    } finally {
      setIsLoading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
        className="hidden"
        id="pdf-upload"
      />
      <label
        htmlFor="pdf-upload"
        className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md transition-colors cursor-pointer ${
          isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Extracting...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span>Import Invoice</span>
          </>
        )}
      </label>
    </div>
  )
}
