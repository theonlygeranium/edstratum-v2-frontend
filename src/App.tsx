/* ──────────────────────────────────────────────────────────────
   App.tsx — EdStratum Labs V2
   Gate 1 fix: lazy-load all below-fold sections with Suspense
   Gate 2: LazyMotion strict + domAnimation (async load)
   Accessibility: MotionConfig reducedMotion="user"
   ────────────────────────────────────────────────────────────── */

import { lazy, Suspense } from 'react'
import { LazyMotion, MotionConfig } from 'motion/react'
import { Helmet } from 'react-helmet-async'
import './index.css'

/* ── SEO constants ────────────────────────────────────────────── */
const SITE_URL = 'https://edstratumlabs.ai'
const SITE_NAME = 'EdStratum Labs'
const SITE_TITLE = 'EdStratum Labs — AI Strategy & Implementation'
const SITE_DESC =
  'EdStratum Labs delivers production-grade AI strategy, LLM integration, ' +
  'and intelligent learning systems for healthcare, SaaS, and higher education. ' +
  'Based in San Francisco, CA.'
const OG_IMAGE = `${SITE_URL}/og-image.png`

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: OG_IMAGE,
  description: SITE_DESC,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'San Francisco',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
  areaServed: 'Worldwide',
  serviceType: [
    'AI Strategy Consulting',
    'LLM Integration Architecture',
    'Conversational AI & Voice Agent Design',
    'Customer Education & Enablement Systems',
    'Canvas LMS Custom Plugin Development',
    'AI Implementation for EdTech',
  ],
  knowsAbout: [
    'Artificial Intelligence',
    'Large Language Models',
    'Instructional Design',
    'Canvas LMS',
    'Enterprise Learning & Development',
    'RAG Architecture',
    'Voice AI',
  ],
  sameAs: [
    'https://www.linkedin.com/company/edstratumlabs',
    'https://www.upwork.com/agencies/edstratumlabs',
  ],
}

/* ── Critical path — static imports (above fold, must not flash) ── */
import Navbar from './components/Navbar'
import Hero   from './sections/Hero'

/* ── Below fold — lazy loaded after initial paint ── */
const Services = lazy(() => import('./sections/Services'))
const About    = lazy(() => import('./sections/About'))
const FAQ      = lazy(() => import('./sections/FAQ'))
const Contact  = lazy(() => import('./sections/Contact'))
const Footer   = lazy(() => import('./sections/Footer'))

/* ── Async feature loader — defers 15KB domAnimation bundle
   until after hydration (4.6KB initial vs 34KB bare motion) ── */
const loadMotionFeatures = () =>
  import('motion/react').then((mod) => mod.domAnimation)

/* ── Minimal section skeleton — prevents CLS during lazy load ── */
function SectionSkeleton() {
  return (
    <div
      className="w-full py-24 lg:py-32 animate-pulse"
      aria-hidden="true"
    >
      <div className="max-w-5xl mx-auto px-6 space-y-4">
        <div className="h-4 w-24 rounded-full bg-surface mx-auto" />
        <div className="h-8 w-64 rounded-full bg-surface mx-auto" />
        <div className="h-4 w-96 rounded-full bg-surface mx-auto" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    /* strict: runtime error if bare motion.* renders inside tree */
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">

        {/* ── SEO head tags ─────────────────────────────────────── */}
        <Helmet>
          <html lang="en" />
          <title>{SITE_TITLE}</title>
          <meta name="description" content={SITE_DESC} />
          <link rel="canonical" href={SITE_URL} />

          {/* Open Graph */}
          <meta property="og:type"        content="website" />
          <meta property="og:url"         content={SITE_URL} />
          <meta property="og:title"       content={SITE_TITLE} />
          <meta property="og:description" content={SITE_DESC} />
          <meta property="og:image"       content={OG_IMAGE} />
          <meta property="og:image:width"  content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:site_name"   content={SITE_NAME} />
          <meta property="og:locale"      content="en_US" />

          {/* Twitter Card */}
          <meta name="twitter:card"        content="summary_large_image" />
          <meta name="twitter:title"       content={SITE_TITLE} />
          <meta name="twitter:description" content={SITE_DESC} />
          <meta name="twitter:image"       content={OG_IMAGE} />

          {/* Additional crawl signals */}
          <meta name="robots"   content="index, follow" />
          <meta name="author"   content={SITE_NAME} />
          <meta name="keywords" content="AI strategy consulting, LLM integration, Canvas LMS, instructional design AI, customer education AI, voice agent, EdTech AI, San Francisco AI consultant" />

          {/* JSON-LD structured data */}
          <script type="application/ld+json">
            {JSON.stringify(JSON_LD)}
          </script>
        </Helmet>

        <div className="min-h-screen bg-background text-text antialiased">

          {/* Critical path — no Suspense boundary needed */}
          <Navbar />
          <main id="main-content">
            <Hero />

            {/* Below-fold sections — lazy loaded in document order */}
            <Suspense fallback={<SectionSkeleton />}>
              <Services />
            </Suspense>

            <Suspense fallback={<SectionSkeleton />}>
              <About />
            </Suspense>

            <Suspense fallback={<SectionSkeleton />}>
              <FAQ />
            </Suspense>

            <Suspense fallback={<SectionSkeleton />}>
              <Contact />
            </Suspense>
          </main>

          <Suspense fallback={null}>
            <Footer />
          </Suspense>

        </div>
      </MotionConfig>
    </LazyMotion>
  )
}
