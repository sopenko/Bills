import { parseISO, differenceInDays } from 'date-fns'

/**
 * Common suffixes/words to remove when normalizing vendor names
 */
const VENDOR_NOISE_WORDS = [
  'payments?',
  'payment',
  'bill',
  'bills',
  'ach',
  'electronic',
  'debit',
  'inc',
  'llc',
  'corp',
  'corporation',
  'company',
  'co',
  'autopay',
  'auto pay',
  'online',
  'ebill',
  'e-bill',
  'direct',
  'services?',
  'utilities?',
  'utility',
]

/**
 * Normalize vendor name for matching
 * Removes common suffixes, special characters, and standardizes formatting
 */
export function normalizeVendorName(name) {
  if (!name) return ''

  let normalized = name.toLowerCase()

  // Remove common noise words
  const noisePattern = new RegExp(`\\b(${VENDOR_NOISE_WORDS.join('|')})\\b`, 'gi')
  normalized = normalized.replace(noisePattern, '')

  // Remove special characters except spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '')

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized
}

/**
 * Check if two vendor names match
 * Uses normalized comparison with substring matching
 */
export function vendorNamesMatch(name1, name2) {
  const norm1 = normalizeVendorName(name1)
  const norm2 = normalizeVendorName(name2)

  if (!norm1 || !norm2) return false

  // Exact match after normalization
  if (norm1 === norm2) return true

  // One contains the other (for cases like "ComEd" vs "ComEd Electric")
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true

  // Check if first word matches (the main vendor name)
  const words1 = norm1.split(' ').filter(Boolean)
  const words2 = norm2.split(' ').filter(Boolean)

  if (words1[0] && words2[0] && words1[0] === words2[0]) return true

  return false
}

/**
 * Check if two amounts match within tolerance
 */
export function amountsMatch(amount1, amount2, tolerance = 0.01) {
  const a1 = Number(amount1)
  const a2 = Number(amount2)
  return Math.abs(a1 - a2) <= tolerance
}

/**
 * Check if a bank transaction date is within range of a bill due date
 * Bank transactions can be before or after the due date
 */
export function datesMatch(bankDate, billDueDate, daysTolerance = 7) {
  const date1 = typeof bankDate === 'string' ? parseISO(bankDate) : bankDate
  const date2 = typeof billDueDate === 'string' ? parseISO(billDueDate) : billDueDate

  const daysDiff = Math.abs(differenceInDays(date1, date2))
  return daysDiff <= daysTolerance
}

/**
 * Find a matching bank transaction for a utility bill
 * Returns the best match or null if no match found
 */
export function findMatchingTransaction(bill, bankTransactions, options = {}) {
  const {
    amountTolerance = 0.01,
    daysTolerance = 7,
  } = options

  let bestMatch = null
  let bestScore = 0

  for (const tx of bankTransactions) {
    // Check all three matching criteria
    const amountMatch = amountsMatch(bill.amount, tx.amount, amountTolerance)
    const dateMatch = datesMatch(tx.due_date, bill.due_date, daysTolerance)
    const vendorMatch = vendorNamesMatch(bill.name, tx.name)

    if (amountMatch && dateMatch && vendorMatch) {
      // Calculate a score based on how close the match is
      const txDate = typeof tx.due_date === 'string' ? parseISO(tx.due_date) : tx.due_date
      const billDate = typeof bill.due_date === 'string' ? parseISO(bill.due_date) : bill.due_date
      const daysDiff = Math.abs(differenceInDays(txDate, billDate))

      // Score: lower daysDiff = higher score
      const score = daysTolerance - daysDiff

      if (score > bestScore) {
        bestScore = score
        bestMatch = tx
      }
    }
  }

  return bestMatch
}

/**
 * Process all bills and return matched/unmatched groups
 * @param {Array} utilityBills - Bills with source='invoice'
 * @param {Array} bankTransactions - Bills with source='bank_statement', 'plaid', or 'credit_card'
 * @param {Object} options - Matching options
 * @returns {Object} { matched, unmatchedBills, unmatchedTransactions }
 */
export function reconcileBills(utilityBills, bankTransactions, options = {}) {
  const matched = []
  const unmatchedBills = []
  const usedTransactionIds = new Set()

  // Find matches for each utility bill
  for (const bill of utilityBills) {
    // Only look at transactions that haven't been matched yet
    const availableTransactions = bankTransactions.filter(
      tx => !usedTransactionIds.has(tx.id)
    )

    const matchingTx = findMatchingTransaction(bill, availableTransactions, options)

    if (matchingTx) {
      matched.push({
        bill,
        transaction: matchingTx,
      })
      usedTransactionIds.add(matchingTx.id)
    } else {
      unmatchedBills.push(bill)
    }
  }

  // Find unmatched transactions
  const unmatchedTransactions = bankTransactions.filter(
    tx => !usedTransactionIds.has(tx.id)
  )

  return {
    matched,
    unmatchedBills,
    unmatchedTransactions,
  }
}

/**
 * Get unique providers from a list of bills
 */
export function getUniqueProviders(bills) {
  const providers = new Set()
  bills.forEach(bill => {
    if (bill.name) {
      providers.add(bill.name)
    }
  })
  return Array.from(providers).sort()
}
