/* ──────────────────────────────────────────────────────────────
   motionVariants.ts — EdStratum Labs V2
   Shared variant definitions for all sections.
   KB2: only opacity + transform (x, y, scale) animated.
        staggerChildren capped to keep total stagger <= 400ms.
   Skill: framer-motion-interactions — restraint principle enforced.
   ────────────────────────────────────────────────────────────── */

import type { Variants } from 'motion/react'

/* ── Transition presets ── */
export const transitions = {
  enter: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1.0] as const },
  micro: { duration: 0.15, ease: 'easeOut' as const },
  spring: { type: 'spring', stiffness: 420, damping: 28, mass: 0.8 } as const,
  snapSpring: { type: 'spring', stiffness: 500, damping: 32 } as const,
} as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: transitions.enter },
  exit: { opacity: 0, y: 16, transition: { duration: 0.2 } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.enter },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
}

export const fadeLeft: Variants = {
  hidden:  { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: transitions.enter },
  exit:    { opacity: 0, x: -16, transition: { duration: 0.2 } },
}

export const fadeRight: Variants = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: transitions.enter },
  exit:    { opacity: 0, x: 16, transition: { duration: 0.2 } },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
}

export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: transitions.enter },
  exit:    { opacity: 0, y: 12, transition: { duration: 0.15 } },
}

export const heroContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

export const heroWord: Variants = {
  hidden:  { opacity: 0, y: 32, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] },
  },
}

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1, transition: transitions.spring },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.15 } },
}

export const cardHover = {
  y: -5, scale: 1.01, transition: transitions.snapSpring,
}

export const buttonHover = { scale: 1.03, y: -1 }
export const buttonTap   = { scale: 0.97 }

export const strataContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
}

export const strataLayer: Variants = {
  hidden:  { opacity: 0, scaleX: 0, originX: 0 },
  visible: {
    opacity: 1, scaleX: 1,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1.0] },
  },
}

export const sectionHeading: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] },
  },
}

export const scrollBarTransition = {
  stiffness: 200, damping: 30, restDelta: 0.001,
}
