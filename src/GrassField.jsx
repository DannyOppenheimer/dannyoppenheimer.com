import { useEffect, useRef } from 'react'
import profilePhoto from './assets/profile.jpg'

/* ---------------------------------------------------------------------------
   GrassField
   A canvas of "grass" — minimalist dots seen from a bird's-eye view. Drag the
   cursor across them and each dot stretches into a capsule, laying down in the
   push direction. When the cursor leaves they keep their heading and shrink
   back to rest.

   Beyond the plain blades there are "jumbo" blades that hold real content and
   share the same physics (sway, lay-down, push):
   - The profile picture — a giant blade with the photo on its tip.
   - Six icon blades — social links + resume, clickable, icon drawn on the tip.
   - One "bar" blade labelled PROJECTS.
   The title text carves clean holes in the grid (one per line).

   All the tunable controls live in one block below, with consistent units:
   distances in pixels, durations in seconds, and a couple of 0..1 dials.
   --------------------------------------------------------------------------- */

// ============================ CONTROLS =====================================

// --- Field layout (pixels) ---
const SPACING = 50 // gap between little blades (horizontal)
const ROW_RATIO = 0.87 // row spacing as a fraction of SPACING (hex-ish packing)
const BLADE_RADIUS = 9 // radius of a little blade's dot
const LAY_DISTANCE = 15 // how far a little blade stretches when fully laid
const CURSOR_REACH = 80 // how near the cursor must be to push a little blade
const BIG_GAP = 16 // clear space kept around jumbo blades
const BORDER_MIN_GAP = 40 // min spacing between any two dots along an obstacle's border
const NAME_BORDER_PAD = 6 // px the title's border dots sit outside the carved hole

// --- Motion (seconds; smaller = quicker). Frame-rate independent. ---
const LAY_TIME = 0.08 // time for a little blade to lay down
const STAND_TIME = 0.5 // time for a little blade to stand back up
const TURN_TIME = 0.12 // time for a little blade to swing to a new heading
const LINGER = 0.4 // how long a blade stays down after the cursor leaves
const CURSOR_LAG = 0.1 // smoothing on cursor velocity (camera-follow feel)
const MIN_CURSOR_SPEED = 40 // px/s — ignore cursor drift slower than this

// --- Push direction ---
const PUSH_BIAS = 0.8 // 0 = lay along cursor movement, 1 = lay straight away

// --- Profile-picture blade (its own size + slower timing) ---
const PFP_LAY_DISTANCE = 14 // how far the pfp body stretches when pushed
const PFP_INSET = 12 // orange border left showing around the photo at rest
const PFP_REACH_PAD = 80 // cursor reach beyond the photo's edge
const PFP_LAY_TIME = 0.2 // pfp time to lay down (slower than little blades)
const PFP_STAND_TIME = 1.1 // pfp time to stand back up
const PFP_TURN_TIME = 0.4 // pfp time to swing to a new heading

// --- Icon blades (social links + resume) ---
const ICON_LAY_DISTANCE = 12 // how far an icon blade's body stretches
const ICON_REACH_PAD = 60 // cursor reach beyond an icon's edge
const ICON_LAY_TIME = 0.12 // icon time to lay down
const ICON_STAND_TIME = 0.8 // icon time to stand back up
const ICON_TURN_TIME = 0.3 // icon time to swing to a new heading

// --- Projects bar ---
const BAR_LAY_DISTANCE = 12 // how far the bar lifts off its root when pushed
const BAR_REACH_PAD = 50 // cursor reach beyond the bar's edge

// --- Title carve (little blades don't render behind the name) ---
const NAME_PAD = 24 // px the carved hole extends past the text

// --- Ambient breeze ---
const SWAY_AMP = 2.4 // px the tips wander
const SWAY_PERIOD = 6 // seconds per breeze cycle

// --- Colors ---
const GRASS_COLOR = '#c2410c'
const SHADOW_COLOR = 'rgba(90, 40, 10, 0.16)'
const RING_COLOR = '#ffffff'

// --- Dance party (click the profile picture) ---
// One scripted routine the whole field performs together, mouse turned off.
// Distances in px, the timeline below in seconds. Each blade gets a random hue
// that also drifts over time, so the field reads as a neon rave.
const DANCE_REACH = 30 // how far a little blade shoots out on each move
const DANCE_BIG = 1.5 // pulse "big" size (× normal radius)
const DANCE_SMALL = 0.6 // pulse "small" size
const DANCE_HUE_DRIFT = 70 // deg/s the rave colors rotate
const DANCE_JUMBO_REACH = 1.4 // jumbo blades travel a bit further than little ones
// The routine, in order: [segment name, seconds]. Total run time is their sum;
// when it elapses the field returns to normal interactive mode.
const DANCE_SEQ = [
  ['nw', 0.8], // extend northwest, return to center
  ['ne', 0.8], // extend northeast, return
  ['sw', 0.8], // extend southwest, return
  ['se', 0.8], // extend southeast, return
  ['spin', 2.4], // extend + spin a full 360, adjacent blades counter-rotating
  ['plus', 1.1], // bloom into a "+" star, return
  ['cross', 1.1], // bloom into an "x" star, return
  ['pulse', 3.0], // checkerboard small/big pulse, three times
  ['rippleDiag', 3.0], // a wave of big dots sweeps bottom-left → top-right
  ['rippleRadial', 4.2], // symmetric ripples emanate from the screen centre
  ['finish', 1.0], // settle back to a flat field
]
const DANCE_TOTAL = DANCE_SEQ.reduce((s, seg) => s + seg[1], 0)

// --- Content: the jumbo blades that hold links. Positions are fractions of the
// viewport so they track across sizes. fHalf (bar only) is half its length. ---
const LINKS = [
  { icon: 'linkedin', href: 'https://www.linkedin.com/in/daniel-oppenheimer', fx: 0.262, fy: 0.52 },
  { icon: 'github', href: 'https://github.com/DannyOppenheimer/', fx: 0.162, fy: 0.61 },
  { icon: 'instagram', href: 'https://www.instagram.com/dannyoppenheimer', fx: 0.298, fy: 0.7 },
  { icon: 'camera', href: 'https://www.instagram.com/pancakemesuper/', fx: 0.068, fy: 0.755 },
  { icon: 'mail', href: 'mailto:oppenheimerd1@gmail.com', fx: 0.172, fy: 0.855 },
  { icon: 'file', href: '/resume.pdf', fx: 0.305, fy: 0.875 },
]
const BAR = { label: 'PROJECTS', href: '#projects', fx: 0.645, fy: 0.665, fHalf: 0.082 }

// Icon artwork in a 24×24 viewBox. Brand marks are single fill paths (from
// simple-icons); the rest are stroked line icons drawn in drawIcon().
const ICON_FILL = {
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  instagram:
    'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
}

// ===========================================================================

const SWAY_RATE = (2 * Math.PI) / SWAY_PERIOD
const GRASS_CFG = { lay: LAY_TIME, stand: STAND_TIME, turn: TURN_TIME }
const PFP_CFG = { lay: PFP_LAY_TIME, stand: PFP_STAND_TIME, turn: PFP_TURN_TIME }
const ICON_CFG = { lay: ICON_LAY_TIME, stand: ICON_STAND_TIME, turn: ICON_TURN_TIME }

// Ease `cur` toward `target`, closing the gap over time-constant `time` (s).
// Exponential + dt-based, so the feel is identical at any frame rate.
function approach(cur, target, dt, time) {
  return time <= 0 ? target : cur + (target - cur) * (1 - Math.exp(-dt / time))
}

// Same, but along the shortest way around a circle (for headings).
function approachAngle(cur, target, dt, time) {
  const diff = Math.atan2(Math.sin(target - cur), Math.cos(target - cur))
  return time <= 0 ? target : cur + diff * (1 - Math.exp(-dt / time))
}

// Distance from a point to a horizontal segment centred on (x, y) of half-length
// `half`. With half = 0 it's just the distance to the point.
function segDist(px, py, x, y, half) {
  const dx = Math.max(Math.abs(px - x) - half, 0)
  return Math.hypot(dx, py - y)
}

// --- Outline samplers: evenly spaced points hugging an obstacle's real shape,
// used to give it a clean border of dots the grid alone can't. ---
function circleOutline(cx, cy, R, spacing, phase) {
  const n = Math.max(6, Math.round((2 * Math.PI * R) / spacing))
  const pts = []
  for (let k = 0; k < n; k++) {
    const a = phase + (k / n) * Math.PI * 2
    pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R })
  }
  return pts
}

function stadiumOutline(cx, cy, half, R, spacing) {
  const pts = []
  const nStraight = Math.max(1, Math.round((2 * half) / spacing))
  for (let k = 0; k <= nStraight; k++) {
    const x = cx - half + (2 * half * k) / nStraight
    pts.push({ x, y: cy - R }, { x, y: cy + R })
  }
  const nArc = Math.max(2, Math.round((Math.PI * R) / spacing))
  for (let k = 1; k < nArc; k++) {
    const aR = -Math.PI / 2 + (Math.PI * k) / nArc
    pts.push({ x: cx + half + Math.cos(aR) * R, y: cy + Math.sin(aR) * R })
    const aL = Math.PI / 2 + (Math.PI * k) / nArc
    pts.push({ x: cx - half + Math.cos(aL) * R, y: cy + Math.sin(aL) * R })
  }
  return pts
}

function rectOutline(l, t, r, b, spacing) {
  const pts = []
  const nW = Math.max(1, Math.round((r - l) / spacing))
  const nH = Math.max(1, Math.round((b - t) / spacing))
  for (let k = 0; k <= nW; k++) {
    const x = l + ((r - l) * k) / nW
    pts.push({ x, y: t }, { x, y: b })
  }
  for (let k = 1; k < nH; k++) {
    const y = t + ((b - t) * k) / nH
    pts.push({ x: l, y }, { x: r, y })
  }
  return pts
}

// --- Dance choreography (pure) ----------------------------------------------

// Which segment of the routine are we in, and how far through it (0..1)?
function resolveSeg(td) {
  let start = 0
  for (const [name, dur] of DANCE_SEQ) {
    if (td < start + dur) return { name, t: (td - start) / dur }
    start += dur
  }
  return { name: 'finish', t: 1 }
}

// Smooth 0 → 1 → 0 envelope: a blade shoots out and returns to center.
function outBack(p) {
  return Math.sin(Math.PI * Math.min(Math.max(p, 0), 1))
}

const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const smoothstep = (p) => p * p * (3 - 2 * p)

// A blade's checkerboard parity from its position (adjacent blades differ).
function bladeParity(b) {
  return (Math.round(b.x / SPACING) + Math.round(b.y / (SPACING * ROW_RATIO))) & 1
}

// The dance pose for one blade at this instant: a set of `arms` (direction +
// length in px shooting out of its base) and a size `scale`. Most moves use a
// single arm; the "+"/"x" stars fan out several at once — only possible here,
// never during normal mouse play.
function danceArms(b, parity, segName, t, width, height) {
  const R = DANCE_REACH
  const ob = R * outBack(t)
  switch (segName) {
    case 'nw':
      return { arms: [{ a: (-3 * Math.PI) / 4, len: ob }], scale: 1 }
    case 'ne':
      return { arms: [{ a: -Math.PI / 4, len: ob }], scale: 1 }
    case 'sw':
      return { arms: [{ a: (3 * Math.PI) / 4, len: ob }], scale: 1 }
    case 'se':
      return { arms: [{ a: Math.PI / 4, len: ob }], scale: 1 }
    case 'spin': {
      // Shoot out (first 20%), hold while spinning a full turn (middle 60%),
      // reel back in (last 20%). Checkerboard sets the spin direction.
      const ext = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1
      const spin = clamp01((t - 0.2) / 0.6)
      const dir = parity ? 1 : -1
      return { arms: [{ a: -Math.PI / 2 + dir * 2 * Math.PI * spin, len: R * ext }], scale: 1 }
    }
    case 'plus':
      return { arms: [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => ({ a, len: ob })), scale: 1 }
    case 'cross':
      return {
        arms: [Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, -Math.PI / 4].map((a) => ({ a, len: ob })),
        scale: 1,
      }
    case 'pulse': {
      // Three small/big pulses (six half-steps). Adjacent blades sit on opposite
      // sizes, then everyone switches each step. Smoothed so it breathes.
      const q = t * 6
      const step = Math.floor(q)
      const sizeAt = (s) => (((parity + s) & 1) ? DANCE_BIG : DANCE_SMALL)
      const s = smoothstep(q - step)
      return { arms: [{ a: 0, len: 0 }], scale: sizeAt(step) * (1 - s) + sizeAt(step + 1) * s }
    }
    case 'rippleDiag': {
      // A band of big dots travels from the bottom-left corner to the top-right.
      const u = (b.x / width + (1 - b.y / height)) / 2
      const w = -0.15 + t * 1.3
      const w2 = -0.15 + (t * 1.3 + 0.65) // a trailing second crest
      const bump = Math.max(Math.exp(-(((u - w) / 0.1) ** 2)), 0.6 * Math.exp(-(((u - w2) / 0.1) ** 2)))
      return { arms: [{ a: 0, len: 0 }], scale: 1 + (DANCE_BIG - 1) * bump }
    }
    case 'rippleRadial': {
      // Concentric rings expanding from the centre, with six-fold angular
      // symmetry — the cymatic "sand on a speaker" look.
      const dx = b.x - width / 2
      const dy = b.y - height / 2
      const dist = Math.hypot(dx, dy)
      const ring = Math.sin(dist * 0.035 - t * 2 * Math.PI * 2.2)
      const sym = 0.5 + 0.5 * Math.cos(6 * Math.atan2(dy, dx))
      return { arms: [{ a: 0, len: 0 }], scale: 1 + (DANCE_BIG - 1) * Math.max(0, ring) * sym }
    }
    case 'finish':
    default:
      return { arms: [{ a: 0, len: 0 }], scale: 1 }
  }
}

// A plain blade at (x, y): a flat dot at rest with its own breeze phases.
function makeBlade(x, y) {
  return {
    x,
    y,
    lean: 0,
    angle: 0,
    targetAngle: 0,
    lastHit: -Infinity,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    swaySpeed: 0.7 + Math.random() * 0.6,
    danceHue: Math.random() * 360,
  }
}

// A jumbo (content-holding) blade. Physics state persists across rebuilds;
// x/y/r/halfLen are (re)assigned in build() from the viewport size.
function makeBig(props) {
  return {
    x: 0,
    y: 0,
    r: 50,
    halfLen: 0,
    lean: 0,
    angle: -Math.PI / 2,
    targetAngle: -Math.PI / 2,
    lastHit: -Infinity,
    hitX: 0,
    hitY: 0,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    swaySpeed: 0.5 + Math.random() * 0.35,
    danceHue: Math.random() * 360,
    ...props,
  }
}

function openLink(href) {
  if (href.startsWith('#')) {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  } else if (href.startsWith('mailto:')) {
    window.location.href = href
  } else {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

export default function GrassField({ containerRef, nameRef, onDanceChange }) {
  const canvasRef = useRef(null)
  const onDanceChangeRef = useRef(onDanceChange)
  onDanceChangeRef.current = onDanceChange

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const photo = new Image()
    let photoReady = false
    photo.onload = () => {
      photoReady = true
    }
    photo.src = profilePhoto

    let blades = []
    let width = 0
    let height = 0
    let raf = 0

    // The jumbo content blades, all sharing the little-blade physics. The
    // profile picture is first; then the social/resume icons; then the bar.
    const pfp = makeBig({ kind: 'pfp', layDistance: PFP_LAY_DISTANCE, reachPad: PFP_REACH_PAD, cfg: PFP_CFG })
    const iconBlades = LINKS.map((l) =>
      makeBig({ kind: 'icon', icon: l.icon, href: l.href, fx: l.fx, fy: l.fy, layDistance: ICON_LAY_DISTANCE, reachPad: ICON_REACH_PAD, cfg: ICON_CFG }),
    )
    const bar = makeBig({ kind: 'bar', label: BAR.label, href: BAR.href, fx: BAR.fx, fy: BAR.fy, fHalf: BAR.fHalf, layDistance: BAR_LAY_DISTANCE, reachPad: BAR_REACH_PAD, cfg: ICON_CFG })
    const bigBlades = [pfp, ...iconBlades, bar]

    // x/y: cursor position. px/py: previous frame's position. vx/vy: smoothed
    // velocity (px/s) the blades take their push direction from.
    const pointer = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false }

    // Dance-party mode: a scripted routine that ignores the mouse entirely.
    const dance = { active: false, start: 0 }

    function startDance(now) {
      if (reduced || dance.active) return
      dance.active = true
      dance.start = now
      // Fresh random hues each time so no two parties look alike.
      for (const b of blades) b.danceHue = Math.random() * 360
      for (const b of bigBlades) b.danceHue = Math.random() * 360
      pointer.active = false
      pointer.vx = 0
      pointer.vy = 0
      container.style.cursor = ''
      onDanceChangeRef.current?.(true)
    }

    function endDance() {
      dance.active = false
      pointer.active = false
      pointer.vx = 0
      pointer.vy = 0
      onDanceChangeRef.current?.(false)
    }

    // One padded box per title line (relative to the canvas) used to carve holes.
    function nameBoxes() {
      const el = nameRef && nameRef.current
      if (!el) return []
      const cr = container.getBoundingClientRect()
      const kids = el.children.length ? el.children : [el]
      const boxes = []
      for (const k of kids) {
        const nr = k.getBoundingClientRect()
        boxes.push({
          l: nr.left - cr.left - NAME_PAD,
          t: nr.top - cr.top - NAME_PAD,
          r: nr.right - cr.left + NAME_PAD,
          b: nr.bottom - cr.top + NAME_PAD,
        })
      }
      return boxes
    }

    function build() {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Jumbo profile blade in the top-left.
      pfp.r = Math.max(70, Math.min(130, Math.min(width, height) * 0.13))
      pfp.x = Math.max(width * 0.12, pfp.r + 30)
      pfp.y = Math.max(pfp.r + 30, Math.min(height * 0.22, height * 0.4))

      // Icon + bar sizing, then place each from its viewport fraction.
      const baseIconR = Math.max(30, Math.min(54, Math.min(width, height) * 0.058))
      const iconR = baseIconR * 0.75
      for (const b of iconBlades) {
        b.r = iconR
        b.x = b.fx * width
        b.y = Math.max(iconR + 8, Math.min(height - iconR - 8, b.fy * height))
      }
      bar.r = baseIconR * 0.82
      bar.halfLen = Math.max(baseIconR * 1.5, width * bar.fHalf)
      bar.x = Math.min(width - bar.halfLen - bar.r - 8, bar.fx * width)
      bar.y = Math.max(bar.r + 8, Math.min(height - bar.r - 8, bar.fy * height))

      const boxes = nameBoxes()
      // The title's border dots sit a touch outside the carved holes.
      const nameBorders = boxes.map((box) => ({
        l: box.l - NAME_BORDER_PAD,
        t: box.t - NAME_BORDER_PAD,
        r: box.r + NAME_BORDER_PAD,
        b: box.b + NAME_BORDER_PAD,
      }))

      // Is (x, y) inside any jumbo blade's footprint (skipping index `except`)?
      const underBig = (x, y, except) => {
        for (let i = 0; i < bigBlades.length; i++) {
          if (i === except) continue
          const bb = bigBlades[i]
          if (segDist(x, y, bb.x, bb.y, bb.halfLen) < bb.r + BIG_GAP + BLADE_RADIUS) return true
        }
        return false
      }
      // Inside a title line's border box (skipping index `except`)?
      const inName = (x, y, except) => {
        for (let i = 0; i < nameBorders.length; i++) {
          if (i === except) continue
          const nb = nameBorders[i]
          if (x > nb.l && x < nb.r && y > nb.t && y < nb.b) return true
        }
        return false
      }

      // 1) Conforming border dots that hug each obstacle's real shape.
      const border = []
      bigBlades.forEach((bb, i) => {
        const R = bb.r + BIG_GAP + BLADE_RADIUS
        const pts =
          bb.halfLen > 0
            ? stadiumOutline(bb.x, bb.y, bb.halfLen, R, SPACING)
            : circleOutline(bb.x, bb.y, R, SPACING, i * 0.7)
        for (const p of pts) {
          if (!underBig(p.x, p.y, i) && !inName(p.x, p.y, -1)) border.push(p)
        }
      })
      // The title: outline each line, dropping points inside the other line's box
      // so the two lines share one clean union outline (no seam through the middle).
      nameBorders.forEach((nb, j) => {
        for (const p of rectOutline(nb.l, nb.t, nb.r, nb.b, SPACING)) {
          if (!inName(p.x, p.y, j) && !underBig(p.x, p.y, -1)) border.push(p)
        }
      })

      // 2) Thin the field so no two dots crowd. Border dots are placed first so
      // they win; the regular grid then fills whatever space is left.
      const dots = []
      const far = (x, y) => {
        for (const d of dots) {
          const dx = d.x - x
          const dy = d.y - y
          if (dx * dx + dy * dy < BORDER_MIN_GAP * BORDER_MIN_GAP) return false
        }
        return true
      }
      for (const p of border) if (far(p.x, p.y)) dots.push(p)

      // 3) The regular background grid, skipping obstacles + crowded border dots.
      const rowStep = SPACING * ROW_RATIO
      const rows = Math.ceil(height / rowStep) + 1
      const cols = Math.ceil(width / SPACING) + 1
      for (let r2 = 0; r2 < rows; r2++) {
        const rowOffset = (r2 % 2) * (SPACING / 2)
        for (let c = 0; c < cols; c++) {
          const x = c * SPACING + rowOffset
          const y = r2 * rowStep
          if (underBig(x, y, -1)) continue
          if (boxes.some((box) => x >= box.l && x <= box.r && y >= box.t && y <= box.b)) continue
          if (far(x, y)) dots.push({ x, y })
        }
      }

      blades = dots.map((p) => makeBlade(p.x, p.y))
    }

    // Lay/stand easing + heading, shared by every blade including the jumbo
    // ones. While the cursor is on it (recently hit) it lays down and turns
    // toward the push; once it leaves it KEEPS its heading and only shrinks back
    // to a flat dot, so it never swings around on the way down.
    function settle(b, now, dt, cfg) {
      const held = (now - b.lastHit) / 1000 < LINGER
      const targetLean = held ? 1 : 0
      b.lean = approach(b.lean, targetLean, dt, targetLean > b.lean ? cfg.lay : cfg.stand)
      if (held) {
        b.angle = approachAngle(b.angle, b.targetAngle, dt, cfg.turn)
      }
    }

    // Push a blade if the cursor is moving and within `reach` of its body
    // (a horizontal capsule of half-length `half`). No locking — a blade can be
    // re-aimed every frame the cursor is over it.
    function influence(b, reach, half, dragUx, dragUy, now) {
      const d = segDist(pointer.x, pointer.y, b.x, b.y, half)
      if (d >= reach) return
      const ax = b.x - pointer.x
      const ay = b.y - pointer.y
      const al = Math.hypot(ax, ay)
      const awayUx = al > 0.5 ? ax / al : dragUx
      const awayUy = al > 0.5 ? ay / al : dragUy
      const mixX = dragUx * (1 - PUSH_BIAS) + awayUx * PUSH_BIAS
      const mixY = dragUy * (1 - PUSH_BIAS) + awayUy * PUSH_BIAS
      // First touch after resting: snap the heading while it's still a dot so it
      // grows straight in the push direction (no startup flick), then track it.
      const fresh = (now - b.lastHit) / 1000 >= LINGER
      b.targetAngle = Math.atan2(mixY, mixX)
      if (fresh && b.lean < 0.05) b.angle = b.targetAngle
      b.lastHit = now
    }

    // Draw a 24×24 icon centred at (cx, cy), scaled to `box`, in white.
    function drawIcon(name, cx, cy, box) {
      ctx.save()
      ctx.translate(cx, cy)
      const s = box / 24
      ctx.scale(s, s)
      ctx.translate(-12, -12)
      ctx.fillStyle = RING_COLOR
      ctx.strokeStyle = RING_COLOR
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (ICON_FILL[name]) {
        ctx.fill(new Path2D(ICON_FILL[name]))
      } else if (name === 'camera') {
        ctx.stroke(new Path2D('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'))
        ctx.beginPath()
        ctx.arc(12, 13, 3.2, 0, Math.PI * 2)
        ctx.stroke()
      } else if (name === 'mail') {
        ctx.beginPath()
        ctx.roundRect(2, 4.5, 20, 15, 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(3, 6)
        ctx.lineTo(12, 13)
        ctx.lineTo(21, 6)
        ctx.stroke()
      } else if (name === 'file') {
        ctx.stroke(new Path2D('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'))
        ctx.stroke(new Path2D('M14 2v6h6'))
        ctx.beginPath()
        ctx.moveTo(8, 13)
        ctx.lineTo(16, 13)
        ctx.moveTo(8, 17)
        ctx.lineTo(16, 17)
        ctx.moveTo(8, 9)
        ctx.lineTo(10, 9)
        ctx.stroke()
      }
      ctx.restore()
    }

    // The photo head at the tip of the profile blade: clipped image + white ring.
    function drawPhotoHead(tipX, tipY, r) {
      const pr = r - PFP_INSET
      if (photoReady) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(tipX, tipY, pr, 0, Math.PI * 2)
        ctx.clip()
        const iw = photo.naturalWidth
        const ih = photo.naturalHeight
        const scale = Math.max((2 * pr) / iw, (2 * pr) / ih)
        const dw = iw * scale
        const dh = ih * scale
        ctx.drawImage(photo, tipX - pr - (dw - 2 * pr) * 0.5, tipY - pr - (dh - 2 * pr) * 0.22, dw, dh)
        ctx.restore()
      }
      ctx.strokeStyle = RING_COLOR
      ctx.lineWidth = Math.max(4, r * 0.06)
      ctx.beginPath()
      ctx.arc(tipX, tipY, pr, 0, Math.PI * 2)
      ctx.stroke()
    }

    function drawBig(b, now) {
      const ph = (now / 1000) * SWAY_RATE * b.swaySpeed
      const baseX = b.x + Math.sin(ph + b.phaseX) * SWAY_AMP * 1.2
      const baseY = b.y + Math.cos(ph + b.phaseY) * SWAY_AMP * 0.9
      const len = b.lean * b.layDistance
      const tipX = baseX + Math.cos(b.angle) * len
      const tipY = baseY + Math.sin(b.angle) * len
      b.hitX = tipX
      b.hitY = tipY
      const r = b.r
      ctx.lineCap = 'round'

      if (b.kind === 'bar') {
        const half = b.halfLen
        const sh = r * 0.45
        // The bar's body is its full-width stadium swept from the rooted base up
        // to the head — a rounded parallelogram. Drawn as a closed quad through
        // the four centre-line ends, filled and stroked thick (round join) so the
        // r-wide stroke rounds the corners into the bar's capsule shape.
        const slab = (bx, by, tx, ty) => {
          ctx.beginPath()
          ctx.moveTo(bx - half, by)
          ctx.lineTo(bx + half, by)
          ctx.lineTo(tx + half, ty)
          ctx.lineTo(tx - half, ty)
          ctx.closePath()
        }
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.lineWidth = r * 2

        // Shadow of the whole swept shape, so it reads as planted in the ground.
        ctx.fillStyle = SHADOW_COLOR
        ctx.strokeStyle = SHADOW_COLOR
        slab(baseX, baseY + sh, tipX, tipY + sh)
        ctx.fill()
        ctx.stroke()

        // Orange body: the bar head plus its full-width trail back to the root.
        ctx.fillStyle = GRASS_COLOR
        ctx.strokeStyle = GRASS_COLOR
        slab(baseX, baseY, tipX, tipY)
        ctx.fill()
        ctx.stroke()

        let fontPx = Math.round(r * 0.95)
        ctx.font = `${fontPx}px Bungee, system-ui, sans-serif`
        const maxW = half * 2 - r * 0.8
        const w = ctx.measureText(b.label).width
        if (w > maxW) {
          fontPx = Math.floor((fontPx * maxW) / w)
          ctx.font = `${fontPx}px Bungee, system-ui, sans-serif`
        }
        ctx.fillStyle = RING_COLOR
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.label, tipX, tipY)
        return
      }

      // pfp / icon — a capsule body from root to head, then the head on top.
      const sh = r * 0.16
      ctx.strokeStyle = SHADOW_COLOR
      ctx.lineWidth = r * 2
      ctx.beginPath()
      ctx.moveTo(baseX, baseY + sh)
      ctx.lineTo(tipX, tipY + sh)
      ctx.stroke()

      ctx.strokeStyle = GRASS_COLOR
      ctx.beginPath()
      ctx.moveTo(baseX, baseY)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()

      if (b.kind === 'pfp') drawPhotoHead(tipX, tipY, r)
      else drawIcon(b.icon, tipX, tipY, r * 1.25)
    }

    function draw(now) {
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'

      // Resolve each blade's tip (lay + breeze) once, reused across passes.
      const t = now / 1000
      for (const b of blades) {
        const len = b.lean * LAY_DISTANCE
        const ph = t * SWAY_RATE * b.swaySpeed
        const bx = Math.sin(ph + b.phaseX) * SWAY_AMP
        const by = Math.cos(ph + b.phaseY) * SWAY_AMP * 0.5
        b.ex = b.x + Math.cos(b.angle) * len + bx
        b.ey = b.y + Math.sin(b.angle) * len + by
      }

      const shadowDy = BLADE_RADIUS * 0.55 // contact shadow drops straight down

      // Pass 1 — contact shadows beneath every blade.
      ctx.strokeStyle = SHADOW_COLOR
      ctx.lineWidth = BLADE_RADIUS * 2
      for (const b of blades) {
        ctx.beginPath()
        ctx.moveTo(b.x, b.y + shadowDy)
        ctx.lineTo(b.ex, b.ey + shadowDy)
        ctx.stroke()
      }

      // Pass 2 — the solid bodies. A zero-length round cap is a perfect dot.
      ctx.strokeStyle = GRASS_COLOR
      ctx.lineWidth = BLADE_RADIUS * 2
      for (const b of blades) {
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        ctx.lineTo(b.ex, b.ey)
        ctx.stroke()
      }

      // The jumbo content blades sit on top of the field.
      for (const b of bigBlades) drawBig(b, now)
    }

    // One jumbo blade dancing: its body follows the routine's primary arm and
    // scales with the pulse, recoloured neon, while its head (photo/icon/label)
    // rides the tip exactly as in normal play.
    function drawBigDance(b, td, seg, hue) {
      const { arms, scale } = danceArms(b, bladeParity(b), seg.name, seg.t, width, height)
      const arm = arms[0]
      const len = arm.len * DANCE_JUMBO_REACH
      const tipX = b.x + Math.cos(arm.a) * len
      const tipY = b.y + Math.sin(arm.a) * len
      b.hitX = tipX
      b.hitY = tipY
      const r = b.r * scale
      const color = `hsl(${hue} 100% 60%)`
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (b.kind === 'bar') {
        const half = b.halfLen
        const sh = r * 0.45
        const slab = (bx, by, tx, ty) => {
          ctx.beginPath()
          ctx.moveTo(bx - half, by)
          ctx.lineTo(bx + half, by)
          ctx.lineTo(tx + half, ty)
          ctx.lineTo(tx - half, ty)
          ctx.closePath()
        }
        ctx.lineWidth = r * 2
        ctx.fillStyle = SHADOW_COLOR
        ctx.strokeStyle = SHADOW_COLOR
        slab(b.x, b.y + sh, tipX, tipY + sh)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = color
        ctx.strokeStyle = color
        slab(b.x, b.y, tipX, tipY)
        ctx.fill()
        ctx.stroke()
        let fontPx = Math.round(r * 0.95)
        ctx.font = `${fontPx}px Bungee, system-ui, sans-serif`
        const maxW = half * 2 - r * 0.8
        const w = ctx.measureText(b.label).width
        if (w > maxW) {
          fontPx = Math.floor((fontPx * maxW) / w)
          ctx.font = `${fontPx}px Bungee, system-ui, sans-serif`
        }
        ctx.fillStyle = RING_COLOR
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.label, tipX, tipY)
        return
      }

      const sh = r * 0.16
      ctx.strokeStyle = SHADOW_COLOR
      ctx.lineWidth = r * 2
      ctx.beginPath()
      ctx.moveTo(b.x, b.y + sh)
      ctx.lineTo(tipX, tipY + sh)
      ctx.stroke()

      ctx.strokeStyle = color
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()

      if (b.kind === 'pfp') drawPhotoHead(tipX, tipY, r)
      else drawIcon(b.icon, tipX, tipY, r * 1.25)
    }

    // The whole field running the scripted routine. Two passes (shadows, then
    // neon bodies) so every blade's contact shadow stays beneath the colour.
    function drawDance(now) {
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      const td = (now - dance.start) / 1000
      const seg = resolveSeg(td)
      const shadowDy = BLADE_RADIUS * 0.55

      ctx.strokeStyle = SHADOW_COLOR
      for (const b of blades) {
        const pose = danceArms(b, bladeParity(b), seg.name, seg.t, width, height)
        b.dancePose = pose
        ctx.lineWidth = BLADE_RADIUS * 2 * pose.scale
        for (const arm of pose.arms) {
          ctx.beginPath()
          ctx.moveTo(b.x, b.y + shadowDy)
          ctx.lineTo(b.x + Math.cos(arm.a) * arm.len, b.y + Math.sin(arm.a) * arm.len + shadowDy)
          ctx.stroke()
        }
      }

      for (const b of blades) {
        const { arms, scale } = b.dancePose
        ctx.strokeStyle = `hsl(${(b.danceHue + td * DANCE_HUE_DRIFT) % 360} 100% 60%)`
        ctx.lineWidth = BLADE_RADIUS * 2 * scale
        for (const arm of arms) {
          ctx.beginPath()
          ctx.moveTo(b.x, b.y)
          ctx.lineTo(b.x + Math.cos(arm.a) * arm.len, b.y + Math.sin(arm.a) * arm.len)
          ctx.stroke()
        }
      }

      for (const b of bigBlades) drawBigDance(b, td, seg, (b.danceHue + td * DANCE_HUE_DRIFT) % 360)
    }

    let lastNow = performance.now()

    function frame() {
      const now = performance.now()
      let dt = (now - lastNow) / 1000
      lastNow = now
      if (dt > 0.1) dt = 0.1 // clamp after tab switches / long stalls

      // Dance party owns the field while it runs — no mouse, no physics.
      if (dance.active) {
        drawDance(now)
        if ((now - dance.start) / 1000 >= DANCE_TOTAL) endDance()
        raf = requestAnimationFrame(frame)
        return
      }

      if (pointer.active) {
        // Cursor velocity (px/s) from this frame's movement, then smoothed.
        const rawVx = (pointer.x - pointer.px) / Math.max(dt, 1e-4)
        const rawVy = (pointer.y - pointer.py) / Math.max(dt, 1e-4)
        pointer.px = pointer.x
        pointer.py = pointer.y
        pointer.vx = approach(pointer.vx, rawVx, dt, CURSOR_LAG)
        pointer.vy = approach(pointer.vy, rawVy, dt, CURSOR_LAG)

        const speed = Math.hypot(pointer.vx, pointer.vy)
        if (speed > MIN_CURSOR_SPEED) {
          const dragUx = pointer.vx / speed
          const dragUy = pointer.vy / speed
          for (const b of blades) influence(b, CURSOR_REACH, 0, dragUx, dragUy, now)
          for (const b of bigBlades) influence(b, b.r + b.reachPad, b.halfLen, dragUx, dragUy, now)
        }
      }

      for (const b of blades) settle(b, now, dt, GRASS_CFG)
      for (const b of bigBlades) settle(b, now, dt, b.cfg)

      draw(now)
      raf = requestAnimationFrame(frame)
    }

    // Which clickable jumbo blade (if any) is under canvas-point (x, y).
    function bladeAt(x, y) {
      for (const b of bigBlades) {
        if (b.href && segDist(x, y, b.hitX, b.hitY, b.halfLen) <= b.r) return b
      }
      return null
    }

    // Is (x, y) on the profile-picture head? (Its tip moves while dancing.)
    function onPfp(x, y) {
      return segDist(x, y, pfp.hitX, pfp.hitY, 0) <= pfp.r
    }

    function onMove(e) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (dance.active) {
        // Mouse influence is off during the party; only flag the pfp as clickable.
        container.style.cursor = onPfp(x, y) ? 'pointer' : ''
        return
      }
      if (!pointer.active) {
        pointer.px = x
        pointer.py = y
        pointer.vx = 0
        pointer.vy = 0
      }
      pointer.x = x
      pointer.y = y
      pointer.active = true
      container.style.cursor = bladeAt(x, y) || onPfp(x, y) ? 'pointer' : ''
    }

    function onLeave() {
      pointer.active = false
      pointer.vx = 0
      pointer.vy = 0
      container.style.cursor = ''
    }

    function onClick(e) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // Clicking the profile picture toggles the dance party.
      if (onPfp(x, y)) {
        if (dance.active) endDance()
        else startDance(performance.now())
        return
      }
      if (dance.active) return // links are inert mid-party
      const hit = bladeAt(x, y)
      if (hit) openLink(hit.href)
    }

    build()
    // The title's font loads asynchronously; rebuild once it settles so the
    // carved holes match the final text size.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(build)
    }
    photo.decode?.().catch(() => {})

    container.addEventListener('click', onClick)
    if (reduced) {
      draw(0) // static field, no interaction
    } else {
      raf = requestAnimationFrame(frame)
      container.addEventListener('pointermove', onMove)
      container.addEventListener('pointerleave', onLeave)
    }

    const resize = new ResizeObserver(() => {
      build()
      if (reduced) draw(0)
    })
    resize.observe(container)

    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      container.removeEventListener('click', onClick)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerleave', onLeave)
    }
  }, [containerRef, nameRef])

  return <canvas ref={canvasRef} className="grass-canvas" aria-hidden="true" />
}
