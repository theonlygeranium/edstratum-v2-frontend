/* ──────────────────────────────────────────────────────────────
   Footer — EdStratum Labs V2
   KB3: void background, border-top, muted typography
   Semantic <footer> with nav landmarks and legal copy
   ────────────────────────────────────────────────────────────── */

function StrataLogoSmall() {
  return (
    <img
      src="/logo.png"
      alt="EdStratum Labs"
      height={40}
      style={{ height: '40px', width: 'auto', objectFit: 'contain', display: 'block', mixBlendMode: 'screen' }}
    />
  )
}

const NAV_COLUMNS = [
  {
    heading: 'Services',
    links: [
      { label: 'Canvas LMS Integration',     href: '#services' },
      { label: 'AI Implementation Strategy',  href: '#services' },
      { label: 'Production AI Engineering',   href: '#services' },
      { label: 'Learning Analytics',          href: '#services' },
      { label: 'Workflow Automation',         href: '#services' },
      { label: 'Fractional AI Leadership',    href: '#services' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About',   href: '#about'   },
      { label: 'FAQ',     href: '#faq'     },
      { label: 'Contact', href: '#contact' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer role="contentinfo" className="relative bg-void border-t border-border">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)' }}
        aria-hidden="true"
      />

      <div className="section-container py-14 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 mb-12">

          <div className="sm:col-span-2 lg:col-span-2">
            <a
              href="#hero"
              className="inline-flex items-center gap-3 mb-4 group focus-visible:ring-2 focus-visible:ring-primary rounded-lg outline-none"
              aria-label="EdStratum Labs — back to top"
            >
              <StrataLogoSmall />
            </a>
            <p className="text-sm text-text-muted leading-relaxed text-wrap-pretty max-w-xs mb-6">
              Elite AI strategy and implementation for EdTech platforms and
              growth-stage organizations. Evidence-driven. Production-grade. Boutique.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Instructure Canvas', 'Enterprise AI', 'LLM Integration', 'EdTech'].map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-pill border border-border text-text-disabled font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {NAV_COLUMNS.map(col => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4 font-mono">
                {col.heading}
              </h3>
              <nav aria-label={`${col.heading} links`}>
                <ul className="space-y-2.5" role="list">
                  {col.links.map(link => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-text-disabled hover:text-text-secondary transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-primary rounded outline-none"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-border mb-6" aria-hidden="true" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-disabled text-center sm:text-left">
            &copy; {year} EdStratum Labs. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-text-disabled font-mono">
              Boutique · Evidence-Driven · Precise
            </span>
            <a
              href="mailto:hello@edstratumlabs.ai"
              className="text-xs text-text-disabled hover:text-primary-light transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-primary rounded outline-none"
              rel="noopener"
              aria-label="Email EdStratum Labs"
            >
              hello@edstratumlabs.ai
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
