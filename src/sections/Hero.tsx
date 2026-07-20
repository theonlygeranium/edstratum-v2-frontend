/* ──────────────────────────────────────────────────────────────
   Hero Section — EdStratum Labs V2 (Phase 2: Animated)
   KB2: m.* from motion/react-m, hooks from motion/react
        Only opacity + transform animated (compositor-only)
        MotionConfig reducedMotion="user" inherited from App root
   Skill: framer-motion-interactions
   ────────────────────────────────────────────────────────────── */

import { useRef, useCallback } from 'react'
import * as m from 'motion/react-m'
import {
  useMotionValue,
  useTransform,
  useSpring,
  useScroll,
} from 'motion/react'
import {
  heroContainer,
  heroWord,
  staggerContainer,
  staggerItem,
  scaleIn,
  buttonHover,
  buttonTap,
  transitions,
} from '../lib/motionVariants'

function StatusBadge() {
  return (
    <m.div
      variants={scaleIn}
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill border border-border-bright bg-surface text-xs font-medium text-text-muted tracking-wider uppercase mb-8"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      Available for new engagements
    </m.div>
  )
}

function StrataDivider() {
  const layers = [
    { w: 24, color: 'bg-white',         opacity: 0.80 },
    { w: 20, color: 'bg-primary-hover',  opacity: 0.90 },
    { w: 16, color: 'bg-neon',           opacity: 0.85 },
    { w: 11, color: 'bg-primary',        opacity: 0.70 },
    { w:  7, color: 'bg-primary-light',  opacity: 0.40 },
  ]
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className="flex flex-col gap-1.5 my-8"
      aria-hidden="true"
    >
      {layers.map((l, i) => (
        <m.div
          key={i}
          variants={{
            hidden:  { opacity: 0, scaleX: 0, originX: '0%' },
            visible: {
              opacity: l.opacity,
              scaleX: 1,
              transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1.0] },
            },
          }}
          style={{ width: `${l.w * 4}px` }}
          className={`h-px ${l.color} rounded-full`}
        />
      ))}
    </m.div>
  )
}

function MetricPill({ value, label }: { value: string; label: string }) {
  return (
    <m.div
      variants={staggerItem}
      whileHover={{ scale: 1.04, y: -2, transition: transitions.snapSpring }}
      className="flex flex-col items-center px-6 py-3 rounded-xl border border-border bg-surface/60 backdrop-blur-sm cursor-default"
    >
      <span className="text-2xl font-bold text-gradient leading-none">{value}</span>
      <span className="text-xs text-text-muted mt-1 text-center text-wrap-nowrap">{label}</span>
    </m.div>
  )
}

function SpotlightGlow() {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springX = useSpring(mouseX, { stiffness: 80, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 80, damping: 20 })
  const glowX = useTransform(springX, (v) => `${v}px`)
  const glowY = useTransform(springY, (v) => `${v}px`)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left - rect.width / 2)
    mouseY.set(e.clientY - rect.top - rect.height / 2)
  }, [mouseX, mouseY])

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <m.div className="absolute inset-0 pointer-events-none">
        <m.div
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            x: glowX,
            y: glowY,
            left: 'calc(50% - 300px)',
            top: 'calc(40% - 300px)',
            background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.06) 40%, transparent 70%)',
          }}
        />
      </m.div>
    </div>
  )
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })
  return (
    <m.div
      style={{ scaleX, transformOrigin: 'left' }}
      className="fixed top-0 left-0 right-0 h-px bg-primary z-[60] pointer-events-none"
      aria-hidden="true"
    />
  )
}

export default function Hero() {
  return (
    <>
      <ScrollProgress />
      <section
        id="hero"
        aria-label="Hero — EdStratum Labs"
        className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-void"
      >
        <div className="absolute inset-0 grid-bg pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 hero-glow pointer-events-none" aria-hidden="true" />
        <SpotlightGlow />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)',
            transform: 'translate(30%, 30%)',
          }}
          aria-hidden="true"
        />

        <div className="section-container relative z-10 pt-32 pb-24">
          <div className="mx-auto max-w-4xl text-center">

            <m.div
              initial="hidden"
              animate="visible"
              variants={scaleIn}
              transition={{ ...transitions.spring, delay: 0.1 }}
            >
              <StatusBadge />
            </m.div>

            <m.div
              variants={heroContainer}
              initial="hidden"
              animate="visible"
              className="mb-6"
              aria-label="AI Strategy, Precisely Engineered."
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.15] tracking-tight text-wrap-balance pb-1">
                <m.span variants={heroWord} className="inline-block text-text mr-3">AI</m.span>
                <m.span variants={heroWord} className="inline-block text-text mr-3">Strategy,</m.span>
                <br />
                <m.span variants={heroWord} className="inline-block text-gradient mr-3">Precisely</m.span>
                <m.span variants={heroWord} className="inline-block text-gradient">Engineered.</m.span>
              </h1>
            </m.div>

            <m.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.enter, delay: 0.55 }}
              className="text-lg sm:text-xl text-text-secondary leading-relaxed text-wrap-pretty max-w-2xl mx-auto mb-4"
            >
              EdStratum Labs delivers verifiable AI implementation for EdTech platforms and
              growth-stage organizations. We build on evidence — not hype — and ship production-grade
              systems your team can actually maintain.
            </m.p>

            <m.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="text-sm text-text-muted font-mono tracking-wide mb-10"
            >
              Instructure Canvas · Enterprise AI · LLM Integration · Custom Plugin Development
            </m.p>

            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.enter, delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <m.a
                href="#contact"
                whileHover={buttonHover}
                whileTap={buttonTap}
                transition={transitions.snapSpring}
                className="btn btn-primary glow-violet focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-void outline-none text-sm px-8 py-3"
              >
                Start a Project
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </m.a>
              <m.a
                href="#services"
                whileHover={{ ...buttonHover, scale: 1.02 }}
                whileTap={buttonTap}
                transition={transitions.snapSpring}
                className="btn btn-ghost focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-void outline-none text-sm px-8 py-3"
              >
                View Services
              </m.a>
            </m.div>

            <div className="flex justify-center">
              <StrataDivider />
            </div>

            <m.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              transition={{ delayChildren: 0.9 }}
              className="flex flex-wrap justify-center gap-4 mt-8"
            >
              <MetricPill value="Enterprise" label="AI Experience" />
              <MetricPill value="Canvas"     label="LMS Specialist" />
              <MetricPill value="Full-Stack" label="Implementation" />
              <MetricPill value="Boutique"   label="High-Touch Model" />
            </m.div>
          </div>
        </div>

        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-disabled"
          aria-hidden="true"
        >
          <span className="text-xs tracking-widest uppercase font-mono">Scroll</span>
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <rect x="1" y="1" width="14" height="18" rx="7" stroke="currentColor" strokeWidth="1.25"/>
            <rect x="7" y="5" width="2" height="5" rx="1" fill="currentColor">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0;0,4;0,0"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        </m.div>
      </section>
    </>
  )
}
