export type SentimentSignal = 'neutral' | 'frustration' | 'urgency'

const FRUSTRATION_TERMS = [
  'not working',
  'broken',
  'useless',
  'terrible',
  'hate',
  'frustrated',
  'give up',
  'doesnt work',
  "doesn't work",
  'waste',
]

const URGENCY_TERMS = [
  'asap',
  'urgent',
  'deadline',
  'today',
  'immediately',
  'right now',
  'need this now',
]

const NEGATION_TERMS = [
  "don't",
  'dont',
  'not',
  'never',
  'no',
  "isn't",
  'isnt',
  "wasn't",
  'wasnt',
  "aren't",
  'arent',
  "doesn't",
  'doesnt',
  "didn't",
  'didnt',
  "won't",
  'wont',
  "can't",
  'cant',
  "couldn't",
  'couldnt',
  "wouldn't",
  'wouldnt',
  "shouldn't",
  'shouldnt',
]

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z']/g, '')
}

function termStartIndexes(message: string, term: string) {
  const words = message.toLowerCase().split(/\s+/).map(normalizeWord)
  const termWords = term.toLowerCase().split(/\s+/).map(normalizeWord)
  const indexes: number[] = []

  for (let index = 0; index <= words.length - termWords.length; index += 1) {
    const matches = termWords.every((termWord, offset) => words[index + offset] === termWord)
    if (matches) indexes.push(index)
  }

  return { indexes, words }
}

function hasNegationWithinWindow(message: string, term: string, windowWords = 3) {
  const { indexes, words } = termStartIndexes(message, term)
  return indexes.some((termIndex) => {
    const start = Math.max(0, termIndex - windowWords)
    const precedingWords = words.slice(start, termIndex)
    return precedingWords.some((word) => NEGATION_TERMS.includes(word))
  })
}

function hasAffirmedTerm(message: string, term: string) {
  const lower = message.toLowerCase()
  return lower.includes(term.toLowerCase()) && !hasNegationWithinWindow(lower, term)
}

export function detectSentiment(messages: string[]): SentimentSignal {
  const userMessages = messages.map((message) => message.trim()).filter(Boolean)
  const lastTwo = userMessages.slice(-2)

  if (lastTwo.some((message) => URGENCY_TERMS.some((term) => hasAffirmedTerm(message, term)))) {
    return 'urgency'
  }

  const frustrationCount = userMessages
    .slice(-3)
    .filter((message) => FRUSTRATION_TERMS.some((term) => hasAffirmedTerm(message, term)))
    .length

  return frustrationCount >= 2 ? 'frustration' : 'neutral'
}
