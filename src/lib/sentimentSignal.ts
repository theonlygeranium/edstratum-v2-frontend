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

function includesTerm(message: string, term: string) {
  return message.toLowerCase().includes(term)
}

export function detectSentiment(messages: string[]): SentimentSignal {
  const userMessages = messages.map((message) => message.trim()).filter(Boolean)
  const lastTwo = userMessages.slice(-2)

  if (lastTwo.some((message) => URGENCY_TERMS.some((term) => includesTerm(message, term)))) {
    return 'urgency'
  }

  const frustrationCount = userMessages
    .slice(-3)
    .filter((message) => FRUSTRATION_TERMS.some((term) => includesTerm(message, term)))
    .length

  return frustrationCount >= 2 ? 'frustration' : 'neutral'
}
