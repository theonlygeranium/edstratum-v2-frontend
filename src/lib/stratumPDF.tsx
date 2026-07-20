import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import type { ChatMessage, RagCitation } from '../stratum/stratumTypes'

export interface StratumPDFProps {
  messages: ChatMessage[]
  intakeSummary: Record<string, string>
  sessionId: string
  generatedAt: string
}

const colors = {
  ink: '#16161d',
  muted: '#5c6472',
  border: '#d9dce3',
  surface: '#f6f5fb',
  primary: '#7c3aed',
  dark: '#1e1e2e',
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.ink,
    backgroundColor: '#ffffff',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 18,
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  brand: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: 700,
  },
  title: {
    fontSize: 24,
    lineHeight: 1.18,
    fontWeight: 700,
    color: colors.ink,
  },
  meta: {
    marginTop: 10,
    color: colors.muted,
    lineHeight: 1.4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.ink,
    marginBottom: 9,
  },
  emptyState: {
    color: colors.muted,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  questionCell: {
    width: '38%',
    padding: 8,
    color: colors.muted,
    backgroundColor: colors.surface,
    lineHeight: 1.35,
  },
  answerCell: {
    width: '62%',
    padding: 8,
    lineHeight: 1.35,
  },
  transcript: {
    gap: 8,
  },
  message: {
    padding: 10,
    borderRadius: 5,
    lineHeight: 1.35,
    maxWidth: '86%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.dark,
    color: '#ffffff',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  roleLabel: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  timestamp: {
    marginTop: 5,
    fontSize: 8,
    color: colors.muted,
  },
  citation: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    color: colors.muted,
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: colors.muted,
    fontSize: 8,
  },
})

function formatDate(value: string | number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function filenameSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'session'
}

function CitationList({ citations }: { citations: RagCitation[] }) {
  if (citations.length === 0) {
    return null
  }

  return (
    <View style={styles.citation}>
      {citations.map((citation) => (
        <Text key={`${citation.source}-${citation.excerpt.slice(0, 24)}`}>
          Source: {citation.source} - {citation.excerpt}
        </Text>
      ))}
    </View>
  )
}

function IntakeSummaryTable({ intakeSummary }: { intakeSummary: Record<string, string> }) {
  const rows = Object.entries(intakeSummary).filter(([, answer]) => answer.trim().length > 0)
  if (rows.length === 0) {
    return <Text style={styles.emptyState}>No intake answers were captured for this session.</Text>
  }

  return (
    <View style={styles.table}>
      {rows.map(([question, answer], index) => (
        <View
          key={question}
          style={index === rows.length - 1 ? styles.tableRowLast : styles.tableRow}
          wrap={false}
        >
          <Text style={styles.questionCell}>{question}</Text>
          <Text style={styles.answerCell}>{answer}</Text>
        </View>
      ))}
    </View>
  )
}

function Transcript({ messages }: { messages: ChatMessage[] }) {
  const transcriptMessages = messages.filter((message) => message.role !== 'system')
  if (transcriptMessages.length === 0) {
    return <Text style={styles.emptyState}>No conversation messages were captured.</Text>
  }

  return (
    <View style={styles.transcript}>
      {transcriptMessages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.message,
            message.role === 'user' ? styles.userMessage : styles.assistantMessage,
          ]}
        >
          <Text style={styles.roleLabel}>
            {message.role === 'user' ? 'Visitor' : 'STRATUM'}
          </Text>
          <Text>{message.content || 'Message pending.'}</Text>
          <CitationList citations={message.citations ?? []} />
          <Text style={styles.timestamp}>{formatDate(message.timestamp)}</Text>
        </View>
      ))}
    </View>
  )
}

export function StratumSessionDocument({
  messages,
  intakeSummary,
  sessionId,
  generatedAt,
}: StratumPDFProps) {
  return (
    <Document
      title="EdStratum Labs AI Strategy Intake Summary"
      author="EdStratum Labs"
      subject="STRATUM session summary"
      creator="STRATUM"
      producer="STRATUM"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo} />
            <Text style={styles.brand}>EdStratum Labs</Text>
          </View>
          <Text style={styles.title}>AI Strategy Intake Summary</Text>
          <Text style={styles.meta}>
            Generated {formatDate(generatedAt)}{'\n'}
            Session ID: {sessionId}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intake Summary</Text>
          <IntakeSummaryTable intakeSummary={intakeSummary} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conversation Transcript</Text>
          <Transcript messages={messages} />
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated by STRATUM - edstratumlabs.ai</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function createSessionPDFBlob(props: StratumPDFProps): Promise<Blob> {
  return pdf(<StratumSessionDocument {...props} />).toBlob()
}

export async function downloadSessionPDF(props: StratumPDFProps): Promise<void> {
  const blob = await createSessionPDFBlob(props)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = props.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10)

  anchor.href = url
  anchor.download = `edstratum-intake-${filenameSafe(props.sessionId)}-${date}.pdf`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
