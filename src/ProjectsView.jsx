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
    title: 'Spyfall',
    href: 'https://spyfall.azurewebsites.net/',
    img: '/projects/spyfall.png',
    desc: 'A minimalist online version of the popular social deduction game of Spyfall, built with JS.',
  },
  {
    title: 'BracketHub',
    href: 'https://bracketplexus-b30b9.web.app/',
    img: '/projects/brackethub.png',
    desc: 'Bringing march-madness style tournament grouping, picking, and scoring to any custom tournament. Compete with friends, join public brackets, all for free. Built with React & Firebase.',
  },
  {
    title: 'Drawtex',
    href: 'https://github.com/DannyOppenheimer/Drawtex',
    img: '/projects/drawtex.png',
    desc: 'A Machine-Learning backed note taking app that quickly and easily converts drawn diagrams into Latex. Built with Python, PyTorch, scikit-learn, and more.',
  },
  {
    title: 'Senior Map',
    href: 'https://apc-mhs.com/seniormap/',
    img: '/projects/seniormap.png',
    desc: 'Contributed to a long-running high school project tracking post-grad plans. Updated and integrated new Google Maps API features.',
  },
]

export default function ProjectsView({ origin, onClose }) {
  const [expanded, setExpanded] = useState(false)
  const closingRef = useRef(false)
  const [leaving, setLeaving] = useState(false)
  const rootRef = useRef(null)

  // Which project is currently open (null = all collapsed)
  const [activeProject, setActiveProject] = useState(null)
  const activeProjectRef = useRef(null)
  // Pill rect snapshot that drives the ring animation; keyed so React remounts on change
  const [animRing, setAnimRing] = useState(null)
  const ringElRef = useRef(null)

  const pageRef = useRef(null)
  const pillRefs = useRef([])
  const projectRefs = useRef([])

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

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') startClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Each edge of the ring travels straight to its respective screen edge using
  // the Web Animations API so the 2px border width stays constant throughout.
  useLayoutEffect(() => {
    const el = ringElRef.current
    if (!el || !animRing) return
    const pad = 60
    const vw = window.innerWidth
    const vh = window.innerHeight
    const anim = el.animate(
      [
        {
          left: `${animRing.left}px`,
          top: `${animRing.top}px`,
          width: `${animRing.width}px`,
          height: `${animRing.height}px`,
          borderRadius: '100px',
          opacity: '0.75',
        },
        {
          left: `${-pad}px`,
          top: `${-pad}px`,
          width: `${vw + pad * 2}px`,
          height: `${vh + pad * 2}px`,
          borderRadius: '4px',
          opacity: '0',
        },
      ],
      { duration: 720, easing: 'cubic-bezier(0.15, 0, 0.5, 1)', fill: 'forwards' },
    )
    return () => anim.cancel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animRing?.key])

  // Unmount the ring element once its animation has finished
  useEffect(() => {
    if (!animRing) return
    const id = setTimeout(() => setAnimRing(null), 800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animRing?.key])

  // Open a project. Pass ring:false to skip the ring animation (e.g. initial load).
  const activateProject = useCallback((i, { ring = true } = {}) => {
    if (i === activeProjectRef.current) return
    activeProjectRef.current = i

    if (ring) {
      const pill = pillRefs.current[i]
      if (pill) {
        const rect = pill.getBoundingClientRect()
        setAnimRing({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          key: `${i}-${Date.now()}`,
        })
      }
    }

    setActiveProject(i)
  }, [])

  // On scroll, snap to whichever project item's top is closest to 38% down the
  // container. Simpler and more reliable than IntersectionObserver when all
  // collapsed pills can fit inside a single viewport.
  useEffect(() => {
    if (!expanded) return
    const container = pageRef.current
    if (!container) return

    // Open the first project immediately, no ring on initial load.
    activateProject(0, { ring: false })

    // Brief post-activation pause: Chrome fires synthetic scroll events when
    // content above the viewport shifts (scroll anchoring). We ignore those for
    // ~700ms so a newly-opened project doesn't immediately flip to a neighbour
    // as the previous project's content collapses.
    const scrollPausedRef = { current: false }
    let pauseTimer = null
    const pauseScrollSnap = () => {
      scrollPausedRef.current = true
      clearTimeout(pauseTimer)
      pauseTimer = setTimeout(() => { scrollPausedRef.current = false }, 700)
    }

    // Patch activateProject to also trigger the pause
    const activate = (i, opts) => {
      activateProject(i, opts)
      if (i !== activeProjectRef.current) pauseScrollSnap() // fires AFTER the ref update inside activateProject
    }

    const onScroll = () => {
      if (scrollPausedRef.current) return
      const snapY = container.getBoundingClientRect().top + container.clientHeight * 0.38
      let bestIdx = 0
      let bestDist = Infinity
      PROJECTS.forEach((_, i) => {
        const el = projectRefs.current[i]
        if (!el) return
        const dist = Math.abs(el.getBoundingClientRect().top - snapY)
        if (dist < bestDist) { bestDist = dist; bestIdx = i }
      })
      if (bestIdx !== activeProjectRef.current) {
        pauseScrollSnap()
        activateProject(bestIdx)
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      clearTimeout(pauseTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, activateProject])

  function startClose() {
    closingRef.current = true
    setExpanded(false)
  }

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
    : { left: `${origin.cx}px`, top: `${origin.cy}px`, transform: 'translate(-50%, -50%)', fontSize: `${origin.fontPx}px` }

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

      {/* Ring overlay — WAAPI drives the position/size so border-width stays 2px */}
      {animRing && (
        <div key={animRing.key} ref={ringElRef} className="project__anim-ring" />
      )}

      <div className={`projects__page${expanded ? ' is-open' : ''}`} ref={pageRef}>
        <ul className="projects__list">
          {PROJECTS.map((p, i) => {
            const isActive = activeProject === i
            const side = i % 2 === 0 ? 'left' : 'right'
            return (
              <li
                key={p.title}
                ref={el => { projectRefs.current[i] = el }}
                className={`project project--${side}${isActive ? ' project--open' : ''}`}
              >
                {/* Collapsed pill — alternates left / right */}
                <div className="project__pill-row">
                  <div
                    className="project__pill"
                    ref={el => { pillRefs.current[i] = el }}
                    onClick={() => activateProject(i)}
                    role="button"
                    tabIndex={isActive ? -1 : 0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') activateProject(i) }}
                  >
                    <h2 className="project__pill-title">{p.title}</h2>
                  </div>
                </div>

                {/* Expanded content — height animates via CSS grid trick */}
                <div className="project__body-wrap">
                  <div className="project__body">
                    <div className="project__body-inner">
                      <a className="project__link" href={p.href} target="_blank" rel="noopener noreferrer">
                        <h2 className="project__title">{p.title}</h2>
                      </a>
                      <p className="project__desc">{p.desc}</p>
                      <a href={p.href} target="_blank" rel="noopener noreferrer">
                        <img className="project__img" src={p.img} alt={`${p.title} screenshot`} loading="lazy" />
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
