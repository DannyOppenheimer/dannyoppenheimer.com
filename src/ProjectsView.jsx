import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const ORANGE_RGB = [194, 65, 12]
function neonRgb(h) {
  const c = 0.8
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = 0.6 - c / 2
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

const PROJECTS = [
  {
    title: 'BracketHub',
    href: 'https://bracketplexus-b30b9.web.app/',
    img: '/projects/brackethub.png',
    desc: 'Bringing march-madness style tournament grouping, picking, and scoring to any custom tournament. Compete with friends, join public brackets, all for free. Built with React & Firebase.',
    altText: 'BracketHub tournament bracket interface showing custom tournament creation and competition features',
  },
  {
    title: 'Drawtex',
    href: 'https://github.com/DannyOppenheimer/Drawtex',
    img: '/projects/drawtex.png',
    desc: 'A Machine-Learning backed note taking app that quickly and easily converts drawn diagrams into Latex. Built with Python, PyTorch, scikit-learn, and more.',
    altText: 'Drawtex interface demonstrating hand-drawn diagram recognition and LaTeX conversion',
  },
  {
    title: 'Spyfall',
    href: 'https://spyfall.dannyoppenheimer.com/',
    img: '/projects/spyfall.png',
    desc: 'A minimalist online version of the popular social deduction game of Spyfall, built with JS.',
    altText: 'Spyfall online game interface showing location-based social deduction gameplay',
  },
  {
    title: 'Senior Map',
    href: 'https://apc-mhs.com/seniormap/',
    img: '/projects/seniormap.png',
    desc: 'Contributed to a long-running high school project tracking post-grad plans. Updated and integrated new Google Maps API features.',
    altText: 'Senior Map showing interactive college and career planning tracker with Google Maps integration',
  },
]

export default function ProjectsView({ origin, onClose }) {
  const [expanded, setExpanded] = useState(false)
  const closingRef = useRef(false)
  const [leaving, setLeaving] = useState(false)
  const rootRef = useRef(null)

  const [selected, setSelected] = useState(0)
  const selectedRef = useRef(0)
  const menuRef = useRef(null)
  const itemRefs = useRef([])
  const [cursorY, setCursorY] = useState(0)
  const wheelCooldown = useRef(false)

  // Neon page background when opened mid dance-party
  useLayoutEffect(() => {
    if (!origin.neon) return
    const el = rootRef.current
    const { hue, hueDrift, fadesIn, fadeDur } = origin
    const start = performance.now()
    let raf = 0
    const apply = (now) => {
      const t = (now - start) / 1000
      const h = hue + Math.min(t, Math.max(fadesIn, 0)) * hueDrift
      const mix = t <= fadesIn ? 1 : 1 - (t - fadesIn) / fadeDur
      if (mix <= 0) {
        el.style.removeProperty('--proj-bg')
        return
      }
      const n = neonRgb(h)
      const r = Math.round(ORANGE_RGB[0] + (n[0] - ORANGE_RGB[0]) * mix)
      const g = Math.round(ORANGE_RGB[1] + (n[1] - ORANGE_RGB[1]) * mix)
      const b = Math.round(ORANGE_RGB[2] + (n[2] - ORANGE_RGB[2]) * mix)
      el.style.setProperty('--proj-bg', `rgb(${r} ${g} ${b})`)
      raf = requestAnimationFrame(apply)
    }
    apply(start)
    return () => cancelAnimationFrame(raf)
  }, [origin])

  const maxScale = useMemo(() => {
    const dx = Math.max(origin.cx, window.innerWidth - origin.cx)
    const dy = Math.max(origin.cy, window.innerHeight - origin.cy)
    const halfLen = Math.max(origin.r - origin.h, 1)
    return Math.max(dy / origin.h, dx / halfLen) * 1.06
  }, [origin])

  // Lock body scroll while open
  useEffect(() => {
    const y = window.scrollY
    const b = document.body
    const prev = { overflow: b.style.overflow, position: b.style.position, top: b.style.top, width: b.style.width }
    b.style.overflow = 'hidden'
    b.style.position = 'fixed'
    b.style.top = `-${y}px`
    b.style.width = '100%'
    return () => {
      b.style.overflow = prev.overflow
      b.style.position = prev.position
      b.style.top = prev.top
      b.style.width = prev.width
      window.scrollTo(0, y)
    }
  }, [])

  // Trigger grow-in after first paint
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setExpanded(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  const navigate = useCallback((dir) => {
    const next = Math.max(0, Math.min(PROJECTS.length - 1, selectedRef.current + dir))
    if (next !== selectedRef.current) {
      selectedRef.current = next
      setSelected(next)
    }
  }, [])

  const startClose = useCallback(() => {
    closingRef.current = true
    setExpanded(false)
  }, [])

  // Escape closes, arrow keys navigate the menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') startClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); navigate(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startClose, navigate])

  // Wheel scrolls through projects with a cooldown so one gesture = one step
  useEffect(() => {
    if (!expanded) return
    const el = rootRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      if (wheelCooldown.current) return
      wheelCooldown.current = true
      navigate(e.deltaY > 0 ? 1 : -1)
      setTimeout(() => { wheelCooldown.current = false }, 380)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [expanded, navigate])

  // Keep the ▶ cursor vertically centered on the selected item
  useLayoutEffect(() => {
    const itemEl = itemRefs.current[selected]
    const menuEl = menuRef.current
    if (!itemEl || !menuEl) return
    const iRect = itemEl.getBoundingClientRect()
    const mRect = menuEl.getBoundingClientRect()
    // 24 ≈ cursor glyph height at 1.4rem
    setCursorY(iRect.top - mRect.top + (iRect.height - 24) / 2)
  }, [selected, expanded])

  function onVeilTransitionEnd(e) {
    if (e.propertyName === 'transform' && closingRef.current) setLeaving(true)
  }

  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(onClose, 160)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  const veilStyle = {
    width: origin.r * 2,
    height: origin.h * 2,
    left: origin.cx - origin.r,
    top: origin.cy - origin.h,
    borderRadius: origin.h,
    transform: `scale(${expanded ? maxScale : 1})`,
  }

  const titleStyle = expanded
    ? {
        left: '50%',
        top: 'calc(clamp(1.4rem, 5vh, 3rem) + clamp(2.4rem, 8vw, 5rem) / 2)',
        transform: 'translate(-50%, -50%)',
        fontSize: 'clamp(2.4rem, 8vw, 5rem)',
      }
    : { left: `${origin.labelCx ?? origin.cx}px`, top: `${origin.labelCy ?? origin.cy}px`, transform: 'translate(-50%, -50%)', fontSize: `${origin.fontPx}px` }

  const p = PROJECTS[selected]

  const selectProject = (i) => { selectedRef.current = i; setSelected(i) }

  return (
    <div className={`projects${leaving ? ' is-leaving' : ''}`} role="dialog" aria-label="Projects" aria-modal="true" ref={rootRef}>
      <div className="projects__veil" style={veilStyle} onTransitionEnd={onVeilTransitionEnd} />
      <div className={`projects__topfade${expanded ? ' is-open' : ''}`} aria-hidden="true" />
      <h1 className="projects__title" style={titleStyle}>Projects</h1>

      <button className={`projects__back${expanded ? ' is-open' : ''}`} onClick={startClose} aria-label="Back">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`projects__page${expanded ? ' is-open' : ''}`}>
        <div className="arcade">

          {/* Left: scrollable menu list */}
          <nav className="arcade__menu" ref={menuRef} aria-label="Project navigation">
            <p className="arcade__menu-label">Project Select</p>
            <div className="arcade__cursor" style={{ transform: `translateY(${cursorY}px)` }} aria-hidden="true">▶</div>
            {PROJECTS.map((proj, i) => (
              <div
                key={proj.title}
                ref={el => { itemRefs.current[i] = el }}
                className={`arcade__item${selected === i ? ' arcade__item--sel' : ''}`}
                onClick={() => selectProject(i)}
                role="button"
                tabIndex={0}
                aria-pressed={selected === i}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') selectProject(i) }}
              >
                <span className="arcade__num">0{i + 1}</span>
                <span className="arcade__name">{proj.title}</span>
              </div>
            ))}
            <p className="arcade__hint">↑ ↓ to navigate</p>
          </nav>

          {/* Right: selected project info */}
          <div className="arcade__panel" aria-live="polite" aria-atomic="true">
            <div key={selected} className="arcade__panel-inner">
              <a href={p.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
                <img className="arcade__img" src={p.img} alt={p.altText} />
              </a>
              <a className="arcade__title-link" href={p.href} target="_blank" rel="noopener noreferrer">
                <h2 className="arcade__proj-title">{p.title}</h2>
              </a>
              <p className="arcade__proj-desc">{p.desc}</p>
              <a className="arcade__launch" href={p.href} target="_blank" rel="noopener noreferrer">
                OPEN →
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
