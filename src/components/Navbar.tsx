/* ──────────────────────────────────────────────────────────────
   Navbar — EdStratum Labs V2 (Phase 2: Animated)
   KB2: m.* from motion/react-m, AnimatePresence for mobile menu
        Only opacity + transform animated
   Skill: framer-motion-interactions — AnimatePresence exit states
   ────────────────────────────────────────────────────────────── */

import { useState, useEffect } from 'react'
import * as m from 'motion/react-m'
import { AnimatePresence } from 'motion/react'
import { transitions } from '../lib/motionVariants'

function BrandLogo() {
  return (
    <img
      src="/logo.png"
      alt="EdStratum Labs"
      height={56}
      style={{ height: '56px', width: 'auto', objectFit: 'contain', display: 'block', mixBlendMode: 'screen' }}
    />
  )
}

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'About',    href: '#about'    },
  { label: 'FAQ',      href: '#faq'      },
  { label: 'Contact',  href: '#contact'  },
]

const mobileMenuVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { ...transitions.enter, delay: i * 0.05 },
  }),
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleNavClick = () => setMobileOpen(false)

  return (
    <m.header
      role="banner"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.enter, delay: 0.05 }}
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-surface/80 border-b border-border backdrop-blur-md'
          : 'bg-transparent border-b border-transparent',
      ].join(' ')}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16 sm:h-18">

          <m.a
            href="#hero"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={transitions.snapSpring}
            className="flex items-center focus-visible:ring-2 focus-visible:ring-primary rounded-lg outline-none"
            aria-label="EdStratum Labs — home"
          >
            <BrandLogo />
          </m.a>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <m.a
                key={href}
                href={href}
                whileHover={{ y: -1, opacity: 1 }}
                whileTap={{ scale: 0.97 }}
                transition={transitions.micro}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium text-text-muted',
                  'hover:text-text hover:bg-surface-raised',
                  'focus-visible:ring-2 focus-visible:ring-primary outline-none',
                  'transition-colors duration-150',
                ].join(' ')}
              >
                {label}
              </m.a>
            ))}
            <m.a
              href="#contact"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={transitions.snapSpring}
              className={[
                'ml-3 btn btn-primary',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-void',
                'outline-none',
              ].join(' ')}
            >
              Start a Project
            </m.a>
          </nav>

          <m.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            transition={transitions.snapSpring}
            className={[
              'md:hidden p-2 rounded-lg text-text-muted',
              'hover:text-text hover:bg-surface-raised',
              'focus-visible:ring-2 focus-visible:ring-primary outline-none',
            ].join(' ')}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen(prev => !prev)}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <m.svg
                  key="close"
                  initial={{ opacity: 0, rotate: -45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 45 }}
                  transition={{ duration: 0.15 }}
                  width="20" height="20" viewBox="0 0 20 20" fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                </m.svg>
              ) : (
                <m.svg
                  key="menu"
                  initial={{ opacity: 0, rotate: 45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -45 }}
                  transition={{ duration: 0.15 }}
                  width="20" height="20" viewBox="0 0 20 20" fill="none"
                  aria-hidden="true"
                >
                  <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                </m.svg>
              )}
            </AnimatePresence>
          </m.button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <m.div
            key="mobile-menu"
            id="mobile-menu"
            initial={{ opacity: 0, y: -8, scaleY: 0.97 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ transformOrigin: 'top' }}
            className="md:hidden bg-surface/95 backdrop-blur-md border-t border-border overflow-hidden"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="section-container py-4 flex flex-col gap-1">
              {NAV_LINKS.map(({ label, href }, i) => (
                <m.a
                  key={href}
                  href={href}
                  custom={i}
                  variants={mobileMenuVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onClick={handleNavClick}
                  className={[
                    'px-4 py-3 rounded-lg text-sm font-medium text-text-secondary',
                    'hover:text-text hover:bg-surface-raised',
                    'focus-visible:ring-2 focus-visible:ring-primary outline-none',
                    'transition-colors duration-150',
                  ].join(' ')}
                >
                  {label}
                </m.a>
              ))}
              <m.a
                href="#contact"
                custom={NAV_LINKS.length}
                variants={mobileMenuVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={handleNavClick}
                className={[
                  'mt-2 btn btn-primary w-full justify-center',
                  'focus-visible:ring-2 focus-visible:ring-primary outline-none',
                ].join(' ')}
              >
                Start a Project
              </m.a>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.header>
  )
}
