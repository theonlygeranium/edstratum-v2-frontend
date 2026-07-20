/* ──────────────────────────────────────────────────────────────
   Services Section — EdStratum Labs V2 (Phase 2: Animated)
   KB2: whileInView stagger, viewport={{ once: true }}
        m.* from motion/react-m — no bare motion.div
        Only opacity + transform animated
   Skill: framer-motion-interactions
   ────────────────────────────────────────────────────────────── */

import * as m from 'motion/react-m'
import {
  sectionHeading,
  staggerContainer,
  staggerItem,
  buttonHover,
  buttonTap,
  transitions,
} from '../lib/motionVariants'

interface ServiceCard {
  icon: React.ReactNode
  tag: string
  title: string
  description: string
  bullets: string[]
  accent: 'primary' | 'neon' | 'info'
}

const ACCENT_CLASSES: Record<ServiceCard['accent'], { tag: string; iconBg: string; bullet: string }> = {
  primary: {
    tag:    'bg-primary-dim text-primary-light border-border-glow',
    iconBg: 'bg-primary-dim border-border-glow',
    bullet: 'bg-primary',
  },
  neon: {
    tag:    'bg-primary-dim text-neon border-border-glow',
    iconBg: 'bg-primary-dim border-border-glow',
    bullet: 'bg-neon',
  },
  info: {
    tag:    'bg-info-dim text-info border-border',
    iconBg: 'bg-info-dim border-border',
    bullet: 'bg-info',
  },
}

const SERVICES: ServiceCard[] = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    tag: 'EdTech',
    title: 'Canvas LMS Integration',
    description: 'Purpose-built plugins, custom API workflows, and LTI integrations that extend Instructure Canvas far beyond its out-of-the-box limits.',
    bullets: ['Custom LTI 1.3 tool development', 'Canvas Data 2 pipeline architecture', 'Gradebook automation & reporting', 'Single sign-on and roster sync'],
    accent: 'primary',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    tag: 'Strategy',
    title: 'AI Implementation Strategy',
    description: 'Grounded, evidence-driven roadmaps that identify where AI creates measurable ROI for your organization — and where it does not.',
    bullets: ['LLM selection & evaluation frameworks', 'Build vs. buy analysis with TCO models', 'Responsible AI policy scaffolding', 'Risk and compliance audit trails'],
    accent: 'neon',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    tag: 'Engineering',
    title: 'Production AI Engineering',
    description: 'End-to-end development of AI-powered features — from prompt architecture and RAG pipelines to production deployment and observability.',
    bullets: ['RAG pipeline design & vector DB setup', 'Fine-tuning & evaluation harnesses', 'API integration and cost optimization', 'Observability, logging & model monitoring'],
    accent: 'info',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    tag: 'Analytics',
    title: 'Learning Analytics & Insights',
    description: 'Transform raw LMS event data into actionable intelligence. Surface intervention signals early and measure what instruction actually changes.',
    bullets: ['xAPI / Caliper learner event pipelines', 'Predictive engagement scoring', 'Custom Looker & Tableau dashboards', 'A/B testing frameworks for content'],
    accent: 'primary',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    tag: 'Workflow',
    title: 'AI Workflow Automation',
    description: 'Identify high-friction administrative workflows and replace them with reliable, auditable AI pipelines that free instructional staff for higher-value work.',
    bullets: ['Syllabus parsing & curriculum mapping', 'Automated rubric generation at scale', 'Approval routing and notification ops', 'Document intelligence & extraction'],
    accent: 'neon',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    tag: 'Advisory',
    title: 'Fractional AI Leadership',
    description: 'Embedded strategic counsel for organizations that need senior AI expertise on demand — without the overhead of a full-time executive hire.',
    bullets: ['Vendor evaluation and RFP support', 'IC and team AI skills development', 'Board and executive AI briefings', 'Ongoing architectural review cadence'],
    accent: 'info',
  },
]

function ServiceCardItem({ card, index }: { card: ServiceCard; index: number }) {
  const a = ACCENT_CLASSES[card.accent]
  return (
    <m.article
      variants={staggerItem}
      whileHover={{ y: -6, scale: 1.015, transition: transitions.snapSpring }}
      className="@container glass-card group hover:glass-card-hover perspective-midrange cursor-default"
    >
      <m.div
        whileHover={{ rotateX: -1.5, transition: transitions.snapSpring }}
        className="p-6 @lg:p-8"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="flex items-start justify-between mb-5">
          <m.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ ...transitions.spring, delay: index * 0.04 }}
            className={`p-2.5 rounded-xl border ${a.iconBg} text-primary-light`}
          >
            {card.icon}
          </m.div>
          <span className={`text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-pill border ${a.tag}`}>
            {card.tag}
          </span>
        </div>
        <h3 className="text-lg @lg:text-xl font-bold tracking-tight text-wrap-balance text-text mb-3">
          {card.title}
        </h3>
        <p className="text-sm leading-relaxed text-text-muted text-wrap-pretty mb-5">
          {card.description}
        </p>
        <m.ul
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="space-y-2"
          role="list"
        >
          {card.bullets.map((b) => (
            <m.li
              key={b}
              variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } } }}
              className="flex items-start gap-2.5 text-sm text-text-secondary"
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.bullet}`} aria-hidden="true" />
              {b}
            </m.li>
          ))}
        </m.ul>
      </m.div>
    </m.article>
  )
}

export default function Services() {
  return (
    <section id="services" aria-labelledby="services-heading" className="relative py-24 lg:py-32 bg-background">
      <div className="absolute inset-0 dot-bg opacity-40 pointer-events-none" aria-hidden="true" />
      <div className="section-container relative z-10">
        <m.header
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <m.p variants={sectionHeading} className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-3 font-mono">What We Build</m.p>
          <m.h2 id="services-heading" variants={sectionHeading} className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-wrap-balance mb-4">
            Services Built for{' '}<span className="text-gradient">Measurable Impact</span>
          </m.h2>
          <m.p variants={sectionHeading} className="text-base text-text-muted leading-relaxed text-wrap-pretty">
            Every engagement is scoped to deliver specific, verifiable outcomes.
            No retainers that outlast their ROI. No deliverables that sit in a drawer.
          </m.p>
        </m.header>
        <m.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6"
        >
          {SERVICES.map((card, index) => (
            <ServiceCardItem key={card.title} card={card} index={index} />
          ))}
        </m.div>
        <m.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ ...transitions.enter, delay: 0.2 }}
          className="text-center mt-14"
        >
          <p className="text-sm text-text-muted mb-4">Not sure which service fits your situation?</p>
          <m.a
            href="#contact"
            whileHover={buttonHover}
            whileTap={buttonTap}
            transition={transitions.snapSpring}
            className="btn btn-ghost inline-flex hover:border-border-bright hover:text-text focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
          >
            Let's Talk Scope
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </m.a>
        </m.div>
      </div>
    </section>
  )
}
