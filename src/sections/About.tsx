/* ──────────────────────────────────────────────────────────────
   About Section — EdStratum Labs V2 (Phase 2: Animated)
   KB2: whileInView scroll reveals, strata cascade via variants
        m.* from motion/react-m, only opacity + transform animated
   Skill: framer-motion-interactions — strataLayer scaleX cascade
   ────────────────────────────────────────────────────────────── */

import * as m from 'motion/react-m'
import {
  staggerContainer,
  staggerItem,
  sectionHeading,
  fadeLeft,
  fadeRight,
  scaleIn,
  strataContainer,
  strataLayer,
  transitions,
} from '../lib/motionVariants'

function StrataStack() {
  const layers = [
    { width: '100%',     color: '#FFFFFF', opacity: 0.88, label: 'Data Foundation'      },
    { width: '91.666%',  color: '#8B5CF6', opacity: 0.90, label: 'LMS Architecture'     },
    { width: '83.333%',  color: '#C4B5FD', opacity: 0.85, label: 'AI Integration Layer' },
    { width: '66.666%',  color: '#7C3AED', opacity: 0.75, label: 'Workflow Automation'  },
    { width: '50%',      color: '#A78BFA', opacity: 0.65, label: 'Analytics & Insights' },
    { width: '33.333%',  color: '#DDD6FE', opacity: 0.50, label: 'Strategy Layer'       },
    { width: '16.666%',  color: '#A78BFA', opacity: 0.35, label: 'Advisory'             },
  ]
  return (
    <m.div
      variants={strataContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className="flex flex-col gap-2.5"
      role="img"
      aria-label="EdStratum Labs service layer diagram"
    >
      {layers.map((layer, i) => (
        <m.div key={layer.label} variants={strataLayer} className="flex items-center gap-4 group">
          <m.div
            style={{ width: layer.width, backgroundColor: layer.color, opacity: layer.opacity }}
            whileHover={{ opacity: 1, scale: 1.02, transition: transitions.micro }}
            className="h-3 rounded-full transition-all duration-200 origin-left"
            aria-hidden="true"
          />
          <m.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
            className="text-xs text-text-disabled group-hover:text-text-muted transition-colors duration-200 whitespace-nowrap font-mono"
          >
            {layer.label}
          </m.span>
        </m.div>
      ))}
    </m.div>
  )
}

function CredentialPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <m.div
      variants={staggerItem}
      whileHover={{ scale: 1.02, y: -1, transition: transitions.snapSpring }}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-secondary cursor-default"
    >
      <span className="text-primary-light shrink-0" aria-hidden="true">{icon}</span>
      {text}
    </m.div>
  )
}

const CREDENTIALS = [
  {
    text: 'Enterprise AI practitioner — shipped production LLM systems at scale',
    icon: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 3 3.5.5-2.5 2.5.5 3.5L8 9l-3 1.5.5-3.5L3 4.5l3.5-.5L8 1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/></svg>),
  },
  {
    text: 'Instructure Canvas specialist — LTI, Canvas Data 2, custom plugin developer',
    icon: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.25"/><path d="M5 8h6M5 5.5h6M5 10.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>),
  },
  {
    text: 'SaaS and EdTech background — product, engineering, and GTM experience',
    icon: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l4-4 3 3 5-7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  },
  {
    text: 'Boutique model — every engagement led by the founder, not delegated',
    icon: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.25"/><path d="M2 13c0-3 1.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>),
  },
]

export default function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="relative py-24 lg:py-32 bg-void overflow-hidden">
      <div
        className="absolute left-0 top-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)', transform: 'translate(-50%, -50%)' }}
        aria-hidden="true"
      />
      <div className="section-container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          <m.div variants={fadeLeft} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
            <m.p variants={sectionHeading} className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-3 font-mono">The Origin</m.p>
            <m.h2 id="about-heading" variants={sectionHeading} className="text-3xl sm:text-4xl font-bold tracking-tight text-wrap-balance mb-6">
              Built From the{' '}<span className="text-gradient">Ground Up</span>
            </m.h2>
            <m.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className="space-y-4 text-text-secondary leading-relaxed text-wrap-pretty mb-8">
              <m.p variants={staggerItem}>The name EdStratum Labs is not accidental. A stratum is a distinct layer — each one deposited with precision, each one load-bearing for what comes above it. That is how production AI systems actually work: foundational data quality, clean architecture, then applied intelligence on top.</m.p>
              <m.p variants={staggerItem}>EdStratum Labs was founded by a senior AI practitioner with direct, verifiable experience shipping enterprise-grade AI at SaaS companies. The specialization in Instructure Canvas emerged from years of hands-on work inside EdTech organizations where off-the-shelf tools consistently fell short of the instructional design teams that needed them most.</m.p>
              <m.p variants={staggerItem}>The model is deliberately boutique. Every engagement is led by the founder — not handed to a junior team after the pitch. That constraint imposes quality. It also means clients get a practitioner who has built what they are recommending, not a strategist who has only written about it.</m.p>
            </m.div>
            <m.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CREDENTIALS.map((c) => (<CredentialPill key={c.text} icon={c.icon} text={c.text} />))}
            </m.div>
          </m.div>

          <m.aside variants={fadeRight} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} aria-label="Service layers visualization">
            <m.div whileHover={{ scale: 1.01, transition: transitions.snapSpring }} className="glass-card p-8 lg:p-10">
              <m.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-8">
                <m.p variants={staggerItem} className="text-xs font-mono uppercase tracking-widest text-text-disabled mb-2">Architecture Metaphor</m.p>
                <m.h3 variants={staggerItem} className="text-xl font-bold tracking-tight text-text">Every Layer Is Load-Bearing</m.h3>
                <m.p variants={staggerItem} className="text-sm text-text-muted mt-2 leading-relaxed">AI initiatives fail when foundational layers are weak. EdStratum Labs builds from the ground up — data, architecture, integration, then intelligence.</m.p>
              </m.div>
              <StrataStack />
              <m.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.6 }} className="mt-8 pt-6 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary-dim border border-border-glow flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="var(--color-primary-light)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <p className="text-xs text-text-muted leading-snug">Engagements are scoped to the layer that actually needs work — not sold as full-stack retainers when a targeted fix is warranted.</p>
                </div>
              </m.div>
            </m.div>
            <m.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ ...transitions.spring, delay: 0.3 }} className="mt-5 flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-border bg-surface/60">
              <span className="text-xs text-text-muted">Founder & Principal</span>
              <span className="h-3 w-px bg-border-bright" aria-hidden="true" />
              <span className="text-xs text-text-muted">Senior AI Practitioner</span>
              <span className="h-3 w-px bg-border-bright" aria-hidden="true" />
              <span className="text-xs text-primary-light font-medium">EdStratum Labs</span>
            </m.div>
          </m.aside>

        </div>
      </div>
    </section>
  )
}
