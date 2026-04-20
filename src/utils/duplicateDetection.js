import { parseISO, differenceInDays } from 'date-fns'

/**
 * Check if a new bill might be a duplicate of an existing bill
 * Returns the matching bill if found, null otherwise
 */
export function findDuplicate(newBill, existingBills, options = {}) {
  const {
    amountTolerance = 0.01, // Allow 1 cent difference
    daysTolerance = 3, // Bills within 3 days of each other
    nameMatchThreshold = 0.7, // 70% similarity for names
  } = options

  const newAmount = Number(newBill.amount)
  const newDate = typeof newBill.due_date === 'string' ? parseISO(newBill.due_date) : newBill.due_date
  const newName = normalizeName(newBill.name)

  for (const bill of existingBills) {
    const existingAmount = Number(bill.amount)
    const existingDate = typeof bill.due_date === 'string' ? parseISO(bill.due_date) : bill.due_date
    const existingName = normalizeName(bill.name)

    // Check amount similarity
    const amountMatch = Math.abs(newAmount - existingAmount) <= amountTolerance

    // Check date proximity
    const daysDiff = Math.abs(differenceInDays(newDate, existingDate))
    const dateMatch = daysDiff <= daysTolerance

    // Check name similarity
    const nameSimilarity = calculateSimilarity(newName, existingName)
    const nameMatch = nameSimilarity >= nameMatchThreshold

    // If all three match, it's likely a duplicate
    if (amountMatch && dateMatch && nameMatch) {
      return {
        existingBill: bill,
        confidence: calculateConfidence(amountMatch, daysDiff, nameSimilarity),
        reasons: {
          amountMatch,
          daysDiff,
          nameSimilarity: Math.round(nameSimilarity * 100),
        },
      }
    }

    // Exact amount + exact name = likely duplicate even with different dates
    if (amountMatch && nameSimilarity >= 0.9) {
      return {
        existingBill: bill,
        confidence: 'medium',
        reasons: {
          amountMatch,
          daysDiff,
          nameSimilarity: Math.round(nameSimilarity * 100),
        },
      }
    }
  }

  return null
}

/**
 * Check multiple bills for duplicates
 * Returns array of { bill, duplicate } objects
 */
export function findDuplicates(newBills, existingBills, options = {}) {
  const results = []

  for (const newBill of newBills) {
    const duplicate = findDuplicate(newBill, existingBills, options)
    results.push({
      bill: newBill,
      duplicate,
    })
  }

  return results
}

/**
 * Normalize bill name for comparison
 */
function normalizeName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0
  if (str1 === str2) return 1

  // Check if one contains the other
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.9
  }

  const len1 = str1.length
  const len2 = str2.length

  // Create distance matrix
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  return 1 - distance / maxLen
}

/**
 * Calculate confidence level based on match quality
 */
function calculateConfidence(amountMatch, daysDiff, nameSimilarity) {
  if (amountMatch && daysDiff === 0 && nameSimilarity >= 0.95) {
    return 'high'
  }
  if (amountMatch && daysDiff <= 1 && nameSimilarity >= 0.8) {
    return 'high'
  }
  if (amountMatch && daysDiff <= 3 && nameSimilarity >= 0.7) {
    return 'medium'
  }
  return 'low'
}
