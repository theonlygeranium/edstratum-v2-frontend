/* ──────────────────────────────────────────────────────────────
   FAQ Section — EdStratum Labs V2 (Phase 2: Animated)
   KB2: AnimatePresence mode="sync" for accordion panel exit
        layout prop on container — Motion handles height math
        m.* from motion/react-m — no bare motion.div
        Only opacity + scaleY + y animated (compositor-only)
   Skill: framer-motion-interactions — AnimatePresence accordion
   ────────────────────────────────────────────────────────────── */

import { useState, useRef, useCallback } from 'react'
import * as m from 'motion/react-m'
import { AnimatePresence } from 'motion/react'
import {
  staggerContainer,
  staggerItem,
  sectionHeading,
  scaleIn,
  buttonHover,
  buttonTap,
  transitions,
} from '../lib/motionVariants'

interface FAQItem { question: string; answer: string }

const FAQS: FAQItem[] = [
  {
    question: "Do I need to disclose my existing AI vendors to work with EdStratum Labs?",
    answer: "No disclosure is required upfront. Engagements begin with a structured discovery session that maps your current stack, data flows, and pain points. Vendor context surfaces naturally through that process. EdStratum Labs is vendor-neutral — recommendations are grounded in your specific requirements and measurable fit, not referral relationships.",
  },
  {
    question: "How is EdStratum Labs different from a traditional consulting firm?",
    answer: "Three distinctions matter most. First, every engagement is led by the founder — a practitioner who has shipped production AI systems, not a generalist who researches them. Second, work is scoped to deliver specific, verifiable outcomes, not open-ended retainers. Third, the specialization in Instructure Canvas and EdTech is deep and current, not a slide deck assembled from public documentation.",
  },
  {
    question: "What does a typical engagement look like?",
    answer: "Engagements vary by scope but follow a consistent pattern: discovery and current-state audit, a prioritized recommendations report with supporting evidence, implementation (where applicable), and a handoff with documentation your team can maintain. Most initial engagements run four to eight weeks. Fractional advisory arrangements are structured separately on a monthly basis.",
  },
  {
    question: "Can you work with organizations that have no existing AI infrastructure?",
    answer: "Yes — and this is frequently the most valuable starting point. Organizations without entrenched tooling have more architectural freedom. The risk is moving fast toward solutions before the foundational data and workflow layers are stable enough to support them. EdStratum Labs maps that foundation first, which prevents the most common and expensive failure mode in AI adoption.",
  },
  {
    question: "Do you build Canvas plugins directly, or only advise on them?",
    answer: "Both. EdStratum Labs designs and builds production Canvas LTI tools, custom API integrations, and Canvas Data 2 pipelines. Delivery includes full documentation, test coverage, and a working handoff to your engineering team. Advisory-only scopes are also available for organizations with internal Canvas developers who need architectural guidance rather than build capacity.",
  },
  {
    question: "How do you handle confidentiality and data security?",
    answer: "All engagements are covered by a mutual NDA before discovery begins. No client data is processed through third-party AI services without explicit written consent and a documented data handling agreement. Recommendations that involve LLM providers include a data residency and retention analysis as a standard deliverable.",
  },
  {
    question: "What is your pricing model?",
    answer: "Engagements are scoped and priced as fixed-fee projects. This protects you from scope creep and aligns incentives — the fee does not increase if the work takes longer. Fractional advisory arrangements use a monthly retainer with a defined hours commitment and clear deliverable cadence. Pricing is provided after a complimentary 30-minute discovery call.",
  },
  {
    question: "Do you work with K-12, higher education, or corporate L&D?",
    answer: "All three, with the deepest specialization in higher education and corporate L&D where Canvas LMS deployment is most prevalent. K-12 engagements typically focus on workflow automation and analytics rather than custom plugin development, given the different procurement and IT governance structures involved.",
  },
]

function FAQAccordionItem({ item, index, isOpen, onToggle, onKeyDown }: {
  item: FAQItem; index: number; isOpen: boolean
  onToggle: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
}) {
  const answerId = `faq-answer-${index}`
  const buttonId = `faq-button-${index}`
  return (
    <m.div
      layout
      variants={staggerItem}
      className={['glass-card overflow-hidden', isOpen ? 'border-border-glow' : ''].join(' ')}
      transition={{ layout: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1.0] } }}
    >
      <m.button
        id={buttonId}
        type="button"
        layout="position"
        aria-expanded={isOpen}
        aria-controls={answerId}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.015)' }}
        whileTap={{ scale: 0.995 }}
        transition={transitions.micro}
        className={[
          'w-full flex items-center justify-between gap-4 px-6 py-5 text-left',
          'text-sm sm:text-base font-semibold tracking-tight',
          isOpen ? 'text-text' : 'text-text-secondary',
          'hover:text-text focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset outline-none transition-colors duration-150',
        ].join(' ')}
      >
        <span className="text-wrap-balance">{item.question}</span>
        <m.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={transitions.snapSpring}
          className={['shrink-0 h-6 w-6 rounded-full border flex items-center justify-center', isOpen ? 'border-border-glow bg-primary-dim text-primary-light' : 'border-border text-text-disabled'].join(' ')}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </m.span>
      </m.button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            key={answerId}
            id={answerId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ opacity: 0, scaleY: 0.95, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.95, y: -4 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
            style={{ transformOrigin: 'top' }}
          >
            <p className="px-6 pb-5 text-sm leading-relaxed text-text-muted text-wrap-pretty">{item.answer}</p>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleToggle = useCallback((index: number) => {
    setOpenIndex(prev => prev === index ? null : index)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); buttonRefs.current[(index + 1) % FAQS.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttonRefs.current[(index - 1 + FAQS.length) % FAQS.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); buttonRefs.current[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); buttonRefs.current[FAQS.length - 1]?.focus() }
  }, [])

  return (
    <section id="faq" aria-labelledby="faq-heading" className="relative py-24 lg:py-32 bg-background">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" aria-hidden="true" />
      <div className="section-container relative z-10">
        <div className="max-w-3xl mx-auto">
          <m.header variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className="text-center mb-12">
            <m.p variants={sectionHeading} className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-3 font-mono">Common Questions</m.p>
            <m.h2 id="faq-heading" variants={sectionHeading} className="text-3xl sm:text-4xl font-bold tracking-tight text-wrap-balance mb-4">
              Answers Before the{' '}<span className="text-gradient">First Call</span>
            </m.h2>
            <m.p variants={sectionHeading} className="text-base text-text-muted leading-relaxed text-wrap-pretty">
              Straightforward answers to the questions that typically come up during evaluation. If your question is not here, ask it directly.
            </m.p>
          </m.header>
          <m.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className="flex flex-col gap-3" role="list">
            {FAQS.map((item, index) => (
              <div key={index} role="listitem">
                <FAQAccordionItem
                  item={item} index={index}
                  isOpen={openIndex === index}
                  onToggle={() => handleToggle(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                />
              </div>
            ))}
          </m.div>
          <m.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="mt-12 text-center p-6 rounded-2xl border border-border bg-surface/50">
            <p className="text-sm text-text-secondary mb-1 font-medium">Have a question that is not listed?</p>
            <p className="text-sm text-text-muted mb-4">Direct, specific questions get direct, specific answers.</p>
            <m.a href="#contact" whileHover={buttonHover} whileTap={buttonTap} transition={transitions.snapSpring} className="btn btn-ghost inline-flex hover:border-border-bright hover:text-text focus-visible:ring-2 focus-visible:ring-primary outline-none">
              Ask Directly
            </m.a>
          </m.div>
        </div>
      </div>
    </section>
  )
}
