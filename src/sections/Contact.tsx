/* ──────────────────────────────────────────────────────────────
   Contact Section — EdStratum Labs V2 (Phase 2: Animated)
   KB2: staggered form field reveals on scroll
        AnimatePresence for success state swap
        m.* from motion/react-m — no bare motion.div
        Only opacity + transform animated (compositor-only)
   Skill: framer-motion-interactions
   ────────────────────────────────────────────────────────────── */

import { useState, useId } from 'react'
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

interface FormState { name: string; email: string; org: string; scope: string; message: string }
interface FormErrors { name?: string; email?: string; message?: string }
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

const SCOPE_OPTIONS = [
  { value: '',               label: 'Select engagement type…'       },
  { value: 'canvas-plugin',  label: 'Canvas LMS Plugin / Integration' },
  { value: 'ai-strategy',    label: 'AI Implementation Strategy'      },
  { value: 'ai-engineering', label: 'Production AI Engineering'       },
  { value: 'analytics',      label: 'Learning Analytics & Insights'   },
  { value: 'automation',     label: 'AI Workflow Automation'          },
  { value: 'fractional',     label: 'Fractional AI Leadership'        },
  { value: 'unsure',         label: "Not sure yet — let's discuss"    },
]

function FormField({ id, label, required, error, hint, children }: {
  id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  const hintId  = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="ml-1 text-primary-light" aria-label="required">*</span>}
      </label>
      {hint && <p id={hintId} className="text-xs text-text-disabled leading-snug">{hint}</p>}
      <div aria-describedby={[hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ')}>{children}</div>
      <AnimatePresence>
        {error && (
          <m.p key={errorId} id={errorId} role="alert"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="text-xs text-error flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M6 4v2.5M6 8h.01" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            {error}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function inputClasses(hasError: boolean) {
  return [
    'w-full px-4 py-3 rounded-xl text-sm text-text bg-surface border transition-all duration-200',
    'placeholder:text-text-disabled outline-none',
    hasError
      ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
      : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20 hover:border-border-bright',
  ].join(' ')
}

function SuccessState() {
  return (
    <m.div
      key="success"
      initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -12 }}
      transition={{ ...transitions.spring, duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 text-center gap-5"
      role="status" aria-live="polite"
    >
      <m.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...transitions.spring, delay: 0.15 }}
        className="h-16 w-16 rounded-full bg-success-dim border border-success/30 flex items-center justify-center glow-neon"
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M6 14l5.5 5.5L22 8" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </m.div>
      <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...transitions.enter, delay: 0.25 }}>
        <h3 className="text-xl font-bold text-text mb-2">Message received.</h3>
        <p className="text-sm text-text-muted max-w-sm leading-relaxed">Expect a direct, substantive response within one business day. No auto-responders. No sales sequence.</p>
      </m.div>
    </m.div>
  )
}

function ContactForm({ form, errors, submitStatus, onChange, onSubmit }: {
  form: FormState; errors: FormErrors; submitStatus: SubmitStatus
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const formId = useId()
  return (
    <m.form key="form" id={formId} onSubmit={onSubmit} noValidate aria-label="Project inquiry form"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
    >
      <m.fieldset variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="border-0 p-0 m-0 space-y-5">
        <legend className="sr-only">Contact information and project details</legend>
        <m.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField id="contact-name" label="Name" required error={errors.name}>
            <input id="contact-name" name="name" type="text" autoComplete="name" placeholder="Your name" value={form.name} onChange={onChange} aria-required="true" aria-invalid={!!errors.name} className={inputClasses(!!errors.name)} />
          </FormField>
          <FormField id="contact-email" label="Work Email" required error={errors.email}>
            <input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@organization.com" value={form.email} onChange={onChange} aria-required="true" aria-invalid={!!errors.email} className={inputClasses(!!errors.email)} />
          </FormField>
        </m.div>
        <m.div variants={staggerItem}>
          <FormField id="contact-org" label="Organization">
            <input id="contact-org" name="org" type="text" autoComplete="organization" placeholder="Institution or company name" value={form.org} onChange={onChange} className={inputClasses(false)} />
          </FormField>
        </m.div>
        <m.div variants={staggerItem}>
          <FormField id="contact-scope" label="Engagement Type" hint="Select the area that most closely matches your need.">
            <select id="contact-scope" name="scope" value={form.scope} onChange={onChange} className={[inputClasses(false), 'cursor-pointer appearance-none'].join(' ')}>
              {SCOPE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value} disabled={opt.value === ''}>{opt.label}</option>))}
            </select>
          </FormField>
        </m.div>
        <m.div variants={staggerItem}>
          <FormField id="contact-message" label="Brief Description" required error={errors.message} hint="What problem are you trying to solve? What have you already tried?">
            <textarea id="contact-message" name="message" rows={5} placeholder="Describe your situation, current stack, and the outcome you're looking for…" value={form.message} onChange={onChange} aria-required="true" aria-invalid={!!errors.message} className={[inputClasses(!!errors.message), 'resize-y min-h-[120px]'].join(' ')} />
          </FormField>
        </m.div>
        <m.div variants={staggerItem} className="pt-2">
          <m.button type="submit" disabled={submitStatus === 'submitting'}
            whileHover={submitStatus !== 'submitting' ? buttonHover : {}}
            whileTap={submitStatus !== 'submitting' ? buttonTap : {}}
            transition={transitions.snapSpring}
            className={['w-full btn btn-primary glow-violet focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface outline-none py-3.5 text-sm', submitStatus === 'submitting' ? 'opacity-70 cursor-not-allowed' : ''].join(' ')}
            aria-busy={submitStatus === 'submitting'}
          >
            {submitStatus === 'submitting' ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending…</>
            ) : (
              <>Send Inquiry<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg></>
            )}
          </m.button>
          <AnimatePresence>
            {submitStatus === 'error' && (
              <m.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-3 text-xs text-error text-center">
                Something went wrong. Please try again or email directly.
              </m.p>
            )}
          </AnimatePresence>
          <p className="mt-4 text-xs text-text-disabled text-center leading-relaxed">No spam. No auto-responders. Your information is used only to respond to this inquiry.</p>
        </m.div>
      </m.fieldset>
    </m.form>
  )
}

export default function Contact() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', org: '', scope: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')

  function validate(data: FormState): FormErrors {
    const e: FormErrors = {}
    if (!data.name.trim()) e.name = 'Your name is required.'
    if (!data.email.trim()) e.email = 'Your email address is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = 'Please enter a valid email address.'
    if (!data.message.trim()) e.message = 'A brief message helps route your inquiry accurately.'
    else if (data.message.trim().length < 20) e.message = 'Please add a bit more detail (at least 20 characters).'
    return e
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors = validate(form)
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setSubmitStatus('submitting')
    /* Stub — replace with real endpoint in Phase 3 */
    await new Promise(resolve => setTimeout(resolve, 1200))
    setSubmitStatus('success')
  }

  return (
    <section id="contact" aria-labelledby="contact-heading" className="relative py-24 lg:py-32 bg-void overflow-hidden">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-64 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(124,58,237,0.12) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="section-container relative z-10">
        <div className="max-w-2xl mx-auto">
          <m.header variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className="text-center mb-12">
            <m.p variants={sectionHeading} className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-3 font-mono">Start a Conversation</m.p>
            <m.h2 id="contact-heading" variants={sectionHeading} className="text-3xl sm:text-4xl font-bold tracking-tight text-wrap-balance mb-4">
              Let's Define the{' '}<span className="text-gradient">Right Scope</span>
            </m.h2>
            <m.p variants={sectionHeading} className="text-base text-text-muted leading-relaxed text-wrap-pretty">
              The first conversation is a 30-minute discovery call — no pitch, no proposal until the problem is accurately defined. Submit a brief below to get started.
            </m.p>
          </m.header>
          <m.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className="glass-card p-8 lg:p-10 overflow-hidden">
            <AnimatePresence mode="wait">
              {submitStatus === 'success' ? <SuccessState key="success" /> : <ContactForm key="form" form={form} errors={errors} submitStatus={submitStatus} onChange={handleChange} onSubmit={handleSubmit} />}
            </AnimatePresence>
          </m.div>
          <m.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...transitions.enter, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-text-disabled"
          >
            <span>Prefer direct contact?</span>
            <m.a href="mailto:hello@edstratumlabs.ai" whileHover={{ color: 'var(--color-primary-light)', transition: transitions.micro }} className="text-text-accent hover:text-primary-light transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-primary rounded outline-none" rel="noopener">
              hello@edstratumlabs.ai
            </m.a>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <m.a href="tel:+14153012306" whileHover={{ color: 'var(--color-primary-light)', transition: transitions.micro }} className="text-text-accent hover:text-primary-light transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-primary rounded outline-none" rel="noopener">
              415-301-2306
            </m.a>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>Typical response: {'<'} 1 business day</span>
          </m.div>
        </div>
      </div>
    </section>
  )
}