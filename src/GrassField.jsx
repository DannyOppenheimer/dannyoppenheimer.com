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

// --- Field layout (pixels). Blades are scattered by Poisson-disk sampling:
// organic blue-noise with roughly equal spacing everywhere and no big gaps,
// flowing around the large features instead of snapping to a grid. ---
const SPACING = 38 // minimum centre-to-centre distance between blades
const BLADE_RADIUS = 9 // radius of a little blade's dot
const LAY_DISTANCE = 15 // how far a little blade stretches when fully laid
const CURSOR_REACH = 75 // how near the cursor must be to push a little blade
const BIG_FEATURE_GAP = 30 // clear space around the big features (photo, projects bar)
const ICON_GAP = 23 // clear space around the small social-link icons
const TITLE_GAP = 0 // clear space around the name title
const OFFSCREEN_PAD = 30 // populate this far past every edge so blades clip off-screen
const RELAX_ITERS = 50 // relaxation passes that even out spacing + circularise borders

// --- Motion (seconds; smaller = quicker). Frame-rate independent. ---
const LAY_TIME = 0.08 // time for a little blade to lay down
const STAND_TIME = 0.5 // time for a little blade to stand back up
const TURN_TIME = 0.12 // time for a little blade to swing to a new heading
const LINGER = 0.4 // how long a blade stays down after the cursor leaves
const CURSOR_LAG = 0.1 // smoothing on cursor velocity (camera-follow feel)
const MIN_CURSOR_SPEED = 0 // px/s — ignore cursor drift slower than this

// --- Push direction ---
const PUSH_BIAS = 1 // 0 = lay along cursor movement, 1 = lay straight away
const MAGNET_PULL = false // false = push away from cursor; true = pull toward it (magnet)

// --- Profile-picture blade (its own size + slower timing) ---
const PFP_LAY_DISTANCE = 8 // how far the pfp body stretches when pushed
const PFP_INSET = 12 // orange border left showing around the photo at rest
const PFP_REACH_PAD = 80 // cursor reach beyond the photo's edge
const PFP_LAY_TIME = 0.2 // pfp time to lay down (slower than little blades)
const PFP_STAND_TIME = 1.1 // pfp time to stand back up
const PFP_TURN_TIME = 0.4 // pfp time to swing to a new heading

// --- Icon blades (social links + resume) ---
const ICON_LAY_DISTANCE = 4 // how far an icon blade's body stretches
const ICON_REACH_PAD = 60 // cursor reach beyond an icon's edge
const ICON_LAY_TIME = 0.12 // icon time to lay down
const ICON_STAND_TIME = 0.8 // icon time to stand back up
const ICON_TURN_TIME = 0.3 // icon time to swing to a new heading
const WHIRL_TIME = 0.225 // s — the email icon's tornado whirl when it swaps glyphs

// --- Projects bar ---
const BAR_LAY_DISTANCE = 4 // how far the bar lifts off its root when pushed
const BAR_REACH_PAD = 50 // cursor reach beyond the bar's edge

// --- Projects title alignment nudge ---
// Fraction of fontPx to shift the parked "Projects" title so it lands exactly
// on the canvas label. Tune by refreshing and checking; scales with font size
// so one value is correct at every viewport size.
const LABEL_CX_NUDGE = 0 // positive = shift right
const LABEL_CY_NUDGE = -0.1 // positive = shift down

// --- Title carve (little blades don't render behind the name) ---
const NAME_PAD = 24 // px the carved hole extends past the text

// --- Ambient breeze ---
const SWAY_AMP = 2.4 // px the tips wander
const SWAY_PERIOD = 6 // seconds per breeze cycle

// --- Colors ---
const GRASS_COLOR = '#c2410c'
const SHADOW_COLOR = 'rgba(90, 40, 10, 0.16)'
const RING_COLOR = '#f7f2e1' // warm cream — social icons, bar label, photo ring

// --- Dance party (click the profile picture) ---
// One scripted routine the whole field performs together, mouse turned off.
// Distances in px, the timeline below in seconds. Each blade gets a random hue
// that also drifts over time, so the field reads as a neon rave.
const DANCE_REACH = 17 // how far a little blade shoots out on each move
const DANCE_BIG = 1.5 // pulse "big" size (× normal radius)
const DANCE_SMALL = 0.6 // pulse "small" size
const DANCE_HUE_DRIFT = 70 // deg/s the rave colors rotate
const DANCE_JUMBO_REACH = 0.5 // jumbo blades travel a bit further than little ones
const DANCE_JUMBO_GROW = 0.35 // how much of the size pulse the (already big) jumbo blades take
const DANCE_INTRO = 0.6 // s — field gathers to rest + colours fade in before the routine
const DANCE_OUTRO = 0.8 // s — colours fade back to orange after the routine
const AUDIO_START = 87 // start the song at 1:27
const AUDIO_VOLUME = 0.85 // peak volume of the dance track
// The routine, in order: [segment name, seconds]. Total run time is their sum;
// when it elapses the field returns to normal interactive mode.
const DANCE_SEQ = [
  ['nw', 0.5], // extend northwest, return to center
  ['ne', 0.5], // extend northeast, return
  ['sw', 0.5], // extend southwest, return
  ['se', 0.5], // extend southeast, return
  ['spin', 1.8], // extend + spin a full 360, adjacent blades counter-rotating
  ['plus', 0.8], // bloom into a "+" star, return
  ['cross', 0.8], // bloom into an "x" star, return
  ['rippleDiag', 3.0], // five ripples sweep the diagonal, several on screen at once
  ['rippleFractal', 3.0], // cymatic water ripple — weird fractal nodal shapes
  ['rippleRadial', 2.8], // symmetric ripples emanate from the screen centre
]
const DANCE_TOTAL = DANCE_SEQ.reduce((s, seg) => s + seg[1], 0)

// --- Content: the jumbo blades that hold links. Positions are fractions of the
// viewport so they track across sizes. fHalf (bar only) is half its length. ---
const LINKS = [
  { icon: 'linkedin', href: 'https://www.linkedin.com/in/daniel-oppenheimer', fx: 0.262, fy: 0.52 },
  { icon: 'github', href: 'https://github.com/DannyOppenheimer/', fx: 0.162, fy: 0.61 },
  { icon: 'instagram', href: 'https://www.instagram.com/dannyoppenheimer', fx: 0.305, fy: 0.875 },
  { icon: 'camera', href: 'https://www.instagram.com/pancakemesuper/', fx: 0.172, fy: 0.855 },
  { icon: 'mail', href: 'copy:oppenheimerd1@gmail.com', fx: 0.068, fy: 0.755 },
  { icon: 'file', href: '/resume.pdf', fx: 0.298, fy: 0.7 },
]
const BAR = { label: 'PROJECTS', href: '#projects', fx: 0.645, fy: 0.665, fHalf: 0.082 }

// --- Mobile layout (< MOBILE_BREAKPOINT px wide) ---
// Below this width the page scrolls vertically; mouse influence is off and
// scroll velocity drives a wind effect instead. Blades are repositioned into a
// vertical stack: pfp centred at the top, icons on the left, bar at the bottom.
const MOBILE_BREAKPOINT = 964
const MOBILE_PFP_FY = 0.10            // pfp centre as fraction of canvas height
const MOBILE_PFP_GAP = 22            // exclusion gap around pfp
// 3-column × 2-row icon grid. Columns at 0.24/0.76 keep end gaps ≥38 px
// (Poisson-disk SPACING) even with the larger icon gap.
const MOBILE_ICON_FXS = [0.24, 0.50, 0.76, 0.24, 0.50, 0.76]  // col (x frac) per icon
const MOBILE_ICON_FYS = [0.54, 0.54, 0.54, 0.70, 0.70, 0.70]  // row (y frac) per icon
const MOBILE_ICON_GAP = 20           // visual gap between grass and icon edges
const MOBILE_BAR_FY = 0.88            // bar centre as fraction of canvas height
const WIND_MAX_VEL = 429             // scroll px/s where mobile wind lean reaches 1.0
const WIND_LAY = 0.15                // time constant for wind lean growth / wrong-dir shrink

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

// Poisson-disk sampling (Bridson). Scatters points across width × height so no
// two are closer than `minDist`, packed as tightly as that rule allows — the
// result is organic but evenly spaced with no clumps or gaps. `accept(x, y)`
// rejects spots overlapping a big feature, so the field flows around them.
function poissonFill(width, height, minDist, accept, pad) {
  const k = 30 // candidate tries per active point before it's retired
  const cell = minDist / Math.SQRT2 // ≤ 1 sample per grid cell → O(1) lookups
  // The domain runs from -pad to width/height + pad, so blades spill past the
  // edges and clip off-screen instead of leaving a bare margin.
  const gw = Math.ceil((width + 2 * pad) / cell)
  const gh = Math.ceil((height + 2 * pad) / cell)
  const grid = new Int32Array(gw * gh).fill(-1)
  const pts = []
  const active = []
  const minD2 = minDist * minDist

  const fits = (x, y) => {
    if (x < -pad || y < -pad || x >= width + pad || y >= height + pad || !accept(x, y)) return false
    const gx = ((x + pad) / cell) | 0
    const gy = ((y + pad) / cell) | 0
    for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2); yy++) {
      for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
        const si = grid[yy * gw + xx]
        if (si !== -1) {
          const p = pts[si]
          const dx = p.x - x
          const dy = p.y - y
          if (dx * dx + dy * dy < minD2) return false
        }
      }
    }
    return true
  }
  const place = (x, y) => {
    grid[(((y + pad) / cell) | 0) * gw + (((x + pad) / cell) | 0)] = pts.length
    active.push(pts.length)
    pts.push({ x, y })
  }

  // Seed somewhere in the open space, then grow to fill everything reachable.
  for (let t = 0; t < 4000 && pts.length === 0; t++) {
    const x = Math.random() * (width + 2 * pad) - pad
    const y = Math.random() * (height + 2 * pad) - pad
    if (fits(x, y)) place(x, y)
  }
  while (active.length) {
    const ai = (Math.random() * active.length) | 0
    const s = pts[active[ai]]
    let found = false
    for (let t = 0; t < k; t++) {
      const ang = Math.random() * Math.PI * 2
      const rad = minDist * (1 + Math.random())
      const x = s.x + Math.cos(ang) * rad
      const y = s.y + Math.sin(ang) * rad
      if (fits(x, y)) {
        place(x, y)
        found = true
        break
      }
    }
    if (!found) {
      active[ai] = active[active.length - 1]
      active.pop()
    }
  }
  return pts
}

// Project (x, y) just outside a feature: if it sits within the feature's own
// gap (`bb.gap`), shove it radially out to a clean ring at `radius + gap`.
// Returns the corrected point. For the bar (halfLen > 0) it's the distance to
// its centre line, so the ring is a stadium that hugs the bar's real shape.
function projectOutOfFeature(x, y, bb) {
  const cx = Math.min(bb.x + bb.halfLen, Math.max(bb.x - bb.halfLen, x))
  const vx = x - cx
  const vy = y - bb.y
  const d = Math.hypot(vx, vy)
  const need = bb.r + bb.gap
  if (d >= need) return { x, y }
  if (d > 1e-4) return { x: cx + (vx / d) * need, y: bb.y + (vy / d) * need }
  return { x: cx + need, y: bb.y }
}

// Lloyd-style relaxation. Each pass: every point drifts away from its near
// neighbours and the walls (toward an even, uniform spacing), then anything
// pushed onto a feature or the title is projected back out. The inner blades
// around a feature, repelling one another while pinned to its gap ring, spread
// into a clean circular arc.
function relaxField(pts, features, boxes, width, height, iters, pad) {
  const R = SPACING * 1.3 // neighbours within this radius push on each other
  const cell = R
  // Padded domain (matches poissonFill) so edge blades clip off-screen.
  const minX = -pad
  const minY = -pad
  const maxX = width + pad
  const maxY = height + pad
  const gw = Math.ceil((maxX - minX) / cell) + 1
  const gh = Math.ceil((maxY - minY) / cell) + 1
  const maxStep = SPACING * 0.35

  const outOfBoxes = (x, y) => {
    for (const box of boxes) {
      if (x >= box.l && x <= box.r && y >= box.t && y <= box.b) {
        const dl = x - box.l
        const dr = box.r - x
        const dt = y - box.t
        const db = box.b - y
        const m = Math.min(dl, dr, dt, db)
        if (m === dl) x = box.l
        else if (m === dr) x = box.r
        else if (m === dt) y = box.t
        else y = box.b
      }
    }
    return { x, y }
  }

  for (let it = 0; it < iters; it++) {
    // Bin the points so each only checks its own cell + neighbours.
    const buckets = new Array(gw * gh)
    for (let i = 0; i < pts.length; i++) {
      const gx = Math.min(gw - 1, Math.max(0, ((pts[i].x - minX) / cell) | 0))
      const gy = Math.min(gh - 1, Math.max(0, ((pts[i].y - minY) / cell) | 0))
      const key = gy * gw + gx
      ;(buckets[key] || (buckets[key] = [])).push(i)
    }

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      let dx = 0
      let dy = 0
      const gx = Math.min(gw - 1, Math.max(0, ((p.x - minX) / cell) | 0))
      const gy = Math.min(gh - 1, Math.max(0, ((p.y - minY) / cell) | 0))
      for (let yy = Math.max(0, gy - 1); yy <= Math.min(gh - 1, gy + 1); yy++) {
        for (let xx = Math.max(0, gx - 1); xx <= Math.min(gw - 1, gx + 1); xx++) {
          const arr = buckets[yy * gw + xx]
          if (!arr) continue
          for (const j of arr) {
            if (j === i) continue
            const ex = p.x - pts[j].x
            const ey = p.y - pts[j].y
            const d2 = ex * ex + ey * ey
            if (d2 < R * R && d2 > 1e-6) {
              const d = Math.sqrt(d2)
              const w = (R - d) / R
              dx += (ex / d) * w
              dy += (ey / d) * w
            }
          }
        }
      }
      // Walls repel too, so edges stay evenly spaced instead of piling up.
      if (p.x - minX < R) dx += (R - (p.x - minX)) / R
      if (maxX - p.x < R) dx -= (R - (maxX - p.x)) / R
      if (p.y - minY < R) dy += (R - (p.y - minY)) / R
      if (maxY - p.y < R) dy -= (R - (maxY - p.y)) / R

      const m = Math.hypot(dx, dy)
      let nx = p.x
      let ny = p.y
      if (m > 1e-6) {
        const step = Math.min(maxStep, m * (SPACING * 0.18))
        nx += (dx / m) * step
        ny += (dy / m) * step
      }
      nx = Math.min(maxX, Math.max(minX, nx))
      ny = Math.min(maxY, Math.max(minY, ny))
      for (const bb of features) {
        const pr = projectOutOfFeature(nx, ny, bb)
        nx = pr.x
        ny = pr.y
      }
      const ob = outOfBoxes(nx, ny)
      p.x = ob.x
      p.y = ob.y
    }
  }
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

// Ramp an effect up at the start of a phase and back down at the end (full
// strength through the middle), so phases blend into one another with no snap.
// `w` is the fraction of the phase spent fading on each side.
const edgeFade = (t, w = 0.18) => smoothstep(clamp01(Math.min(t, 1 - t) / w))

// A blade's neon dance colour (hsl 100% 60%) as rgb, plus a lerp from the
// resting orange toward it — used to fade the field into and out of the rave.
const ORANGE_RGB = [194, 65, 12] // GRASS_COLOR (#c2410c)
function neonRgb(h) {
  const c = 0.8 // chroma for s=1, l=0.6
  const hp = ((((h % 360) + 360) % 360) / 60)
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = 0.6 - c / 2
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
function fadeColor(mix, h) {
  const n = neonRgb(h)
  const r = ORANGE_RGB[0] + (n[0] - ORANGE_RGB[0]) * mix
  const g = ORANGE_RGB[1] + (n[1] - ORANGE_RGB[1]) * mix
  const b = ORANGE_RGB[2] + (n[2] - ORANGE_RGB[2]) * mix
  return `rgb(${r | 0} ${g | 0} ${b | 0})`
}

// A blade's checkerboard parity — a two-tone split by position so neighbours
// mostly alternate. Assigned in build() (the field is no longer a grid).
function bladeParity(b) {
  return b.parity || 0
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
    case 'rippleDiag': {
      // Five crests sweep the diagonal from the top-right down to the bottom-left,
      // a few visible on screen at once.
      const u = (1 - b.x / width + b.y / height) / 2 // 0 at top-right → 1 at bottom-left
      const travel = t * 2.9 // far enough that all five crests fully cross
      let bump = 0
      for (let i = 0; i < 5; i++) {
        const c = travel - 0.2 - i * 0.34
        bump = Math.max(bump, Math.exp(-(((u - c) / 0.085) ** 2)))
      }
      return { arms: [{ a: 0, len: 0 }], scale: 1 + (DANCE_BIG - 1) * bump * edgeFade(t) }
    }
    case 'rippleFractal': {
      // Cymatic "sand on a speaker" pattern: plane waves interfere at six
      // symmetric angles plus a radial standing wave, all breathing over time —
      // giving the weird looping fractal nodal shapes that ripple like water.
      const dx = b.x - width / 2
      const dy = b.y - height / 2
      const rho = Math.hypot(dx, dy)
      const phase = t * Math.PI * 2 * 1.6
      let v = 0
      for (let m = 0; m < 6; m++) {
        const a = (Math.PI * m) / 6
        v += Math.cos((Math.cos(a) * dx + Math.sin(a) * dy) * 0.05 - phase)
      }
      v /= 6
      const ring = Math.cos(rho * 0.045 - phase)
      const cell = Math.abs(v) * 0.7 + Math.abs(ring) * 0.3 // nodal lines → small dots
      const target = DANCE_SMALL + (DANCE_BIG - DANCE_SMALL) * cell
      return { arms: [{ a: 0, len: 0 }], scale: 1 + (target - 1) * edgeFade(t) }
    }
    case 'rippleRadial': {
      // Concentric rings expanding from the centre, with six-fold angular
      // symmetry — the classic cymatic flower.
      const dx = b.x - width / 2
      const dy = b.y - height / 2
      const dist = Math.hypot(dx, dy)
      const ring = Math.sin(dist * 0.03 - t * 2 * Math.PI * 2.5)
      const sym = 0.5 + 0.5 * Math.cos(6 * Math.atan2(dy, dx))
      const target = 1 + (DANCE_BIG - 1) * Math.max(0, ring) * sym
      return { arms: [{ a: 0, len: 0 }], scale: 1 + (target - 1) * edgeFade(t) }
    }
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
    parity: 0,
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
    // Email-icon tornado-whirl state (only the mail blade actually uses it).
    glyph: null,
    pendingGlyph: null,
    whirl: 1,
    whirling: false,
    hover: false,
    copied: false,
    ...props,
  }
}

function openLink(href) {
  if (href.startsWith('copy:')) {
    navigator.clipboard?.writeText(href.slice(5)).catch(() => {})
  } else if (href.startsWith('#')) {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  } else if (href.startsWith('mailto:')) {
    window.location.href = href
  } else {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

export default function GrassField({ containerRef, nameRef, onDanceChange, onOpenProjects, onProjectsReady, projectsOpen }) {
  const canvasRef = useRef(null)
  const onDanceChangeRef = useRef(onDanceChange)
  onDanceChangeRef.current = onDanceChange
  const onOpenProjectsRef = useRef(onOpenProjects)
  onOpenProjectsRef.current = onOpenProjects
  const onProjectsReadyRef = useRef(onProjectsReady)
  onProjectsReadyRef.current = onProjectsReady
  // True while the projects "page" is up: the bar is hidden behind it, so we
  // freeze its breeze sway (and ease it back in on close) — otherwise the live
  // bar would be at a different sway phase than the title parked on it, and the
  // closing title would visibly snap to the bar on reveal.
  const projectsOpenRef = useRef(projectsOpen)
  projectsOpenRef.current = projectsOpen

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
    // Sway amplitude scale for the PROJECTS bar: snaps to 0 (frozen at rest)
    // while the projects page is open, eases back to 1 once it closes.
    let barSway = 1

    // The jumbo content blades, all sharing the little-blade physics. The
    // profile picture is first; then the social/resume icons; then the bar.
    const pfp = makeBig({ kind: 'pfp', gap: BIG_FEATURE_GAP, layDistance: PFP_LAY_DISTANCE, reachPad: PFP_REACH_PAD, cfg: PFP_CFG })
    const iconBlades = LINKS.map((l) =>
      makeBig({ kind: 'icon', gap: ICON_GAP, icon: l.icon, href: l.href, fx: l.fx, fy: l.fy, layDistance: ICON_LAY_DISTANCE, reachPad: ICON_REACH_PAD, cfg: ICON_CFG }),
    )
    const bar = makeBig({ kind: 'bar', gap: BIG_FEATURE_GAP, label: BAR.label, href: BAR.href, fx: BAR.fx, fy: BAR.fy, fHalf: BAR.fHalf, layDistance: BAR_LAY_DISTANCE, reachPad: BAR_REACH_PAD, cfg: ICON_CFG })
    const bigBlades = [pfp, ...iconBlades, bar]

    // x/y: cursor position. px/py: previous frame's position. vx/vy: smoothed
    // velocity (px/s) the blades take their push direction from.
    const pointer = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false }

    // Mobile scroll-wind state. currentMobile is set in build() based on width.
    let currentMobile = false
    let scrollVel = 0   // px/s (positive = scrolling down, blades lean upward)
    let scrollY = window.scrollY
    let scrollTime = performance.now()

    function onScroll() {
      const now = performance.now()
      const dt = Math.max((now - scrollTime) / 1000, 0.001)
      const dy = window.scrollY - scrollY
      scrollVel = dy / dt
      scrollY = window.scrollY
      scrollTime = now
    }

    // The email blade copies the address to the clipboard instead of opening a
    // mail client; it tornado-whirls through clipboard / check glyphs.
    const mailBlade = iconBlades.find((b) => b.icon === 'mail')
    if (mailBlade) {
      mailBlade.glyph = 'mail'
      mailBlade.email = mailBlade.href.slice('copy:'.length)
    }

    function triggerWhirl(b, target) {
      if (b.glyph === target && !b.whirling) return
      b.pendingGlyph = target
      b.whirl = 0
      b.whirling = true
    }

    // Advance the email icon's whirl; it swaps to the new glyph at the half-way
    // pinch so the change is hidden inside the spin.
    function advanceWhirl(dt) {
      for (const b of iconBlades) {
        if (!b.whirling) continue
        b.whirl += dt / WHIRL_TIME
        if (b.whirl >= 0.5 && b.glyph !== b.pendingGlyph) b.glyph = b.pendingGlyph
        if (b.whirl >= 1) {
          b.whirl = 1
          b.whirling = false
        }
      }
    }

    // The dance track, faded in/out around the routine. Metadata-only preload so
    // we don't eagerly pull the whole file on every page load.
    const audio = new Audio('/audio.mp3')
    audio.preload = 'metadata'

    // Dance-party mode: a scripted routine that ignores the mouse entirely. It
    // runs in phases — intro (gather to rest + fade colours/audio in), run (the
    // routine), outro (fade colours/audio back out).
    const dance = { active: false, phase: 'idle', phaseStart: 0, runStart: 0, hueOffset: 0 }

    function startDance(now) {
      if (reduced || dance.active) return
      dance.active = true
      dance.phase = 'intro'
      dance.phaseStart = now
      // Fresh random hues each time so no two parties look alike.
      for (const b of blades) b.danceHue = Math.random() * 360
      for (const b of bigBlades) b.danceHue = Math.random() * 360
      if (mailBlade) {
        mailBlade.glyph = 'mail'
        mailBlade.whirling = false
        mailBlade.hover = false
        mailBlade.copied = false
      }
      pointer.active = false
      pointer.vx = 0
      pointer.vy = 0
      container.style.cursor = ''
      try {
        audio.currentTime = AUDIO_START
      } catch {
        /* not seekable until loaded; the timeupdate below will set it */
      }
      audio.volume = 0
      audio.play().catch(() => {})
      onDanceChangeRef.current?.(true)
    }

    // Jump to the song's start once it can seek (in case currentTime was set
    // before the media was ready).
    audio.addEventListener(
      'loadedmetadata',
      () => {
        if (dance.active && audio.currentTime < 1) audio.currentTime = AUDIO_START
      },
      { once: true },
    )

    function beginOutro(now) {
      if (!dance.active || dance.phase === 'outro') return
      dance.phase = 'outro'
      dance.phaseStart = now
      // Colours fade back from wherever the hue drift left the routine.
      dance.hueOffset = DANCE_TOTAL * DANCE_HUE_DRIFT
      // Capture the title's exact animated color *before* removing the class so
      // the inline fade starts from the precise hue the CSS animation left off on.
      dance.outroStartRgb = null
      if (nameRef && nameRef.current) {
        const m = window.getComputedStyle(nameRef.current).color.match(/\d+/g)
        if (m) dance.outroStartRgb = [+m[0], +m[1], +m[2]]
      }
      // Remove the dancing class (stops CSS animation); we drive color inline now.
      onDanceChangeRef.current?.(false)
      if (nameRef && nameRef.current && dance.outroStartRgb) {
        const [r, g, b] = dance.outroStartRgb
        nameRef.current.style.color = `rgb(${r} ${g} ${b})`
      }
    }

    function endDance() {
      dance.active = false
      dance.phase = 'idle'
      pointer.active = false
      pointer.vx = 0
      pointer.vy = 0
      audio.pause()
      // Clear the inline color set during the outro; CSS var takes over (orange).
      if (nameRef && nameRef.current) {
        nameRef.current.style.color = ''
      }
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

      // Switch mobile mode and update the scroll-wind listener accordingly.
      const wasMobile = currentMobile
      currentMobile = width < MOBILE_BREAKPOINT
      if (currentMobile && !wasMobile) {
        window.addEventListener('scroll', onScroll, { passive: true })
        scrollY = window.scrollY
        scrollTime = performance.now()
      } else if (!currentMobile && wasMobile) {
        window.removeEventListener('scroll', onScroll)
        scrollVel = 0
      }

      if (currentMobile) {
        // Mobile layout: pfp centred at top, icons in a 3×2 grid, bar centred at bottom.
        pfp.r = Math.max(100, Math.min(130, width * 0.28))
        pfp.gap = MOBILE_PFP_GAP
        pfp.x = width * 0.5
        // Floor keeps the pfp circle from being clipped by the canvas top edge.
        pfp.y = Math.max(pfp.r + 8, height * MOBILE_PFP_FY)

        // 3-col × 2-row grid; spread avoids a single-column exclusion wall that
        // would block Poisson-disk from traversing the full canvas.
        const mobileIconR = Math.max(24, Math.min(36, width * 0.08))
        const barR = mobileIconR * 0.85

        // Pixel-floor positions: mirror the CSS name placement (max(300px,46vh))
        // to guarantee icons and bar never overlap the name on short viewports.
        const nameCssTopPx = Math.max(300, window.innerHeight * 0.46)
        const fontSizePx = Math.min(4.5 * 16, Math.max(2.2 * 16, width * 0.11))
        const nameBotPx = nameCssTopPx + fontSizePx * 2
        const row1Floor = nameBotPx + mobileIconR + 20
        const row2Floor = row1Floor + mobileIconR * 2 + 40
        const barFloor = row2Floor + mobileIconR + barR + 40

        iconBlades.forEach((b, i) => {
          b.r = mobileIconR
          b.gap = MOBILE_ICON_GAP
          b.x = width * MOBILE_ICON_FXS[i]
          const fracY = height * MOBILE_ICON_FYS[i]
          const floor = i < 3 ? row1Floor : row2Floor
          b.y = Math.min(height - mobileIconR - 8, Math.max(floor, fracY))
        })
        bar.r = barR
        // Cap half-length so the bar never clips past the screen edges.
        bar.halfLen = Math.min(width * 0.5 - bar.r - 12, Math.max(width * 0.28, mobileIconR * 4))
        bar.x = width * 0.5
        bar.y = Math.min(height - bar.r - 8, Math.max(barFloor, height * MOBILE_BAR_FY))
      } else {
        // Desktop layout — restore full gaps in case we switched from mobile.
        pfp.gap = BIG_FEATURE_GAP
        pfp.r = Math.max(70, Math.min(130, Math.min(width, height) * 0.13))
        pfp.x = Math.max(width * 0.12, pfp.r + 30)
        pfp.y = Math.max(pfp.r + 30, Math.min(height * 0.22, height * 0.4))

        const baseIconR = Math.max(30, Math.min(54, Math.min(width, height) * 0.058))
        const iconR = baseIconR * 0.75
        for (const b of iconBlades) {
          b.r = iconR
          b.gap = ICON_GAP
          b.x = b.fx * width
          b.y = Math.max(iconR + 8, Math.min(height - iconR - 8, b.fy * height))
        }
        bar.r = baseIconR * 0.82
        bar.halfLen = Math.max(baseIconR * 1.5, width * bar.fHalf)
        bar.x = Math.min(width - bar.halfLen - bar.r - 8, bar.fx * width)
        bar.y = Math.max(bar.r + 8, Math.min(height - bar.r - 8, bar.fy * height))
      }

      const fontPx = bar.drawnFontPx || Math.round(bar.r * 0.95)
      onProjectsReadyRef.current?.({
        cx: rect.left + bar.x,
        cy: rect.top + bar.y,
        labelCx: rect.left + bar.x + fontPx * LABEL_CX_NUDGE,
        labelCy: rect.top + bar.y + fontPx * LABEL_CY_NUDGE,
        r: bar.halfLen + bar.r,
        h: bar.r,
        fontPx,
        neon: false,
        hue: 0,
        hueDrift: 0,
        fadesIn: 0,
        fadeDur: 0,
      })

      // The title's no-blade box gets its own gap, separate from the other features.
      const featureBoxes = nameBoxes().map((b) => ({
        l: b.l - TITLE_GAP,
        t: b.t - TITLE_GAP,
        r: b.r + TITLE_GAP,
        b: b.b + TITLE_GAP,
      }))

      // A blade may sit here only if it clears every big feature (its body plus
      // that feature's own gap) and isn't behind the title. Big features and the
      // small icons carry separate gaps, so each is tunable independently.
      const accept = (x, y) => {
        for (const bb of bigBlades) {
          if (segDist(x, y, bb.x, bb.y, bb.halfLen) < bb.r + bb.gap) return false
        }
        for (const box of featureBoxes) {
          if (x >= box.l && x <= box.r && y >= box.t && y <= box.b) return false
        }
        return true
      }

      const pts = poissonFill(width, height, SPACING, accept, OFFSCREEN_PAD)
      // Even out the scatter and let the inner blades settle into a clean ring
      // around each feature.
      relaxField(pts, bigBlades, featureBoxes, width, height, RELAX_ITERS, OFFSCREEN_PAD)
      blades = pts.map((p) => {
        const b = makeBlade(p.x, p.y)
        b.parity = (Math.round(p.x / SPACING) + Math.round(p.y / SPACING)) & 1
        return b
      })
      // The dance gives the jumbo blades a parity too (for counter-rotation etc).
      for (const bb of bigBlades) {
        bb.parity = (Math.round(bb.x / SPACING) + Math.round(bb.y / SPACING)) & 1
      }
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
      // Magnet mode flips the heading so blades reach toward the cursor instead.
      const fresh = (now - b.lastHit) / 1000 >= LINGER
      const dir = MAGNET_PULL ? -1 : 1
      b.targetAngle = Math.atan2(mixY * dir, mixX * dir)
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
        // Detailed SLR: body, pentaprism viewfinder, flash, big lens, dial.
        ctx.beginPath()
        ctx.roundRect(2, 8, 20, 12, 2.5)
        ctx.stroke()
        // Pentaprism hump on top.
        ctx.beginPath()
        ctx.moveTo(8, 8)
        ctx.lineTo(9.3, 4.8)
        ctx.lineTo(14.7, 4.8)
        ctx.lineTo(16, 8)
        ctx.stroke()
        // Flash on the shoulder.
        ctx.beginPath()
        ctx.roundRect(3.4, 6, 2.8, 2, 0.6)
        ctx.stroke()
        // Control dial top-right.
        ctx.beginPath()
        ctx.arc(18.6, 6.8, 1, 0, Math.PI * 2)
        ctx.stroke()
        // Lens (outer + inner ring).
        ctx.beginPath()
        ctx.arc(12, 14, 4.3, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(12, 14, 2.1, 0, Math.PI * 2)
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
      } else if (name === 'clipboard') {
        // Two overlapping cards — the standard "copy" icon.
        ctx.beginPath()
        ctx.roundRect(8, 8, 14, 14, 2)
        ctx.stroke()
        ctx.stroke(new Path2D('M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'))
      } else if (name === 'check') {
        ctx.beginPath()
        ctx.moveTo(5, 12.5)
        ctx.lineTo(10, 17.5)
        ctx.lineTo(19, 6.5)
        ctx.stroke()
      }
      ctx.restore()
    }

    // An icon head that honours the email blade's tornado-whirl glyph swap: while
    // whirling it spins a full turn and pinches to nothing at the half-way point
    // (where the glyph is swapped), then grows back showing the new glyph.
    function drawIconHead(b, cx, cy, box) {
      const glyph = b.glyph || b.icon
      if (b.whirling) {
        const p = clamp01(b.whirl)
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(p * Math.PI * 2)
        const sc = Math.abs(Math.cos(p * Math.PI))
        ctx.scale(sc, sc)
        drawIcon(glyph, 0, 0, box)
        ctx.restore()
      } else {
        drawIcon(glyph, cx, cy, box)
      }
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
        ctx.drawImage(photo, tipX - pr - (dw - 2 * pr) * 0.5, tipY - pr - (dh - 2 * pr) * 0.5, dw, dh)
        ctx.restore()
      }
      ctx.strokeStyle = RING_COLOR
      ctx.lineWidth = Math.max(4, r * 0.06)
      ctx.beginPath()
      ctx.arc(tipX, tipY, pr, 0, Math.PI * 2)
      ctx.stroke()
    }

    function drawBig(b, now, color = GRASS_COLOR) {
      // The bar's sway is damped while the projects page is parked on it.
      const swayScale = b.kind === 'bar' ? barSway : 1
      const ph = (now / 1000) * SWAY_RATE * b.swaySpeed
      const baseX = b.x + Math.sin(ph + b.phaseX) * SWAY_AMP * 1.2 * swayScale
      const baseY = b.y + Math.cos(ph + b.phaseY) * SWAY_AMP * 0.9 * swayScale
      const len = b.lean * b.layDistance
      const tipX = baseX + Math.cos(b.angle) * len
      const tipY = baseY + Math.sin(b.angle) * len
      b.hitX = tipX
      b.hitY = tipY
      const r = b.r
      ctx.lineCap = 'round'

      if (b.kind === 'bar') {
        const half = b.halfLen
        const sh = r * 0.45 * 0.7 // projects bar: a slightly tighter shadow
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

        // Body: the bar head plus its full-width trail back to the root.
        ctx.fillStyle = color
        ctx.strokeStyle = color
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
        b.drawnFontPx = fontPx // the label's real size, handed to the parked title
        ctx.fillStyle = RING_COLOR
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.label, tipX, tipY)
        return
      }

      // pfp / icon — a capsule body from root to head, then the head on top.
      const sh = r * 0.16 * (b.kind === 'pfp' ? 0.7 : 1) // pfp gets a tighter shadow
      ctx.strokeStyle = SHADOW_COLOR
      ctx.lineWidth = r * 2
      ctx.beginPath()
      ctx.moveTo(baseX, baseY + sh)
      ctx.lineTo(tipX, tipY + sh)
      ctx.stroke()

      ctx.strokeStyle = color
      ctx.beginPath()
      ctx.moveTo(baseX, baseY)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()

      if (b.kind === 'pfp') drawPhotoHead(tipX, tipY, r)
      else drawIconHead(b, tipX, tipY, r * 1.25)
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
      // The jumbo blades are already big, so they only take a fraction of the
      // size pulse — otherwise they balloon absurdly.
      const r = b.r * (1 + (scale - 1) * DANCE_JUMBO_GROW)
      const color = `hsl(${hue} 100% 60%)`
      b.liveHue = hue // remembered so a click can hand the live colour to ProjectsView
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (b.kind === 'bar') {
        const half = b.halfLen
        const sh = r * 0.45 * 0.7 // projects bar: a slightly tighter shadow
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

      const sh = r * 0.16 * (b.kind === 'pfp' ? 0.7 : 1) // pfp gets a tighter shadow
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
      else drawIconHead(b, tipX, tipY, r * 1.25)
    }

    // The whole field running the scripted routine. Two passes (shadows, then
    // neon bodies) so every blade's contact shadow stays beneath the colour.
    function drawDance(now) {
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      const td = (now - dance.runStart) / 1000
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

    // The field as flat resting dots, colours lerped between orange (mix 0) and
    // the neon rave (mix 1) and the breeze damped out as mix rises. Drawn either
    // side of the routine so the field gathers in and fades out without snapping.
    function drawTransition(now, mix, hueOffset) {
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      const t = now / 1000
      const swayAmt = 1 - mix
      for (const b of blades) {
        const ph = t * SWAY_RATE * b.swaySpeed
        const bx = Math.sin(ph + b.phaseX) * SWAY_AMP * swayAmt
        const by = Math.cos(ph + b.phaseY) * SWAY_AMP * 0.5 * swayAmt
        b.ex = b.x + Math.cos(b.angle) * b.lean * LAY_DISTANCE + bx
        b.ey = b.y + Math.sin(b.angle) * b.lean * LAY_DISTANCE + by
      }
      const shadowDy = BLADE_RADIUS * 0.55
      ctx.strokeStyle = SHADOW_COLOR
      ctx.lineWidth = BLADE_RADIUS * 2
      for (const b of blades) {
        ctx.beginPath()
        ctx.moveTo(b.x, b.y + shadowDy)
        ctx.lineTo(b.ex, b.ey + shadowDy)
        ctx.stroke()
      }
      ctx.lineWidth = BLADE_RADIUS * 2
      for (const b of blades) {
        ctx.strokeStyle = fadeColor(mix, (b.danceHue + hueOffset) % 360)
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        ctx.lineTo(b.ex, b.ey)
        ctx.stroke()
      }
      for (const b of bigBlades) {
        b.liveHue = (b.danceHue + hueOffset) % 360
        drawBig(b, now, fadeColor(mix, b.liveHue))
      }
    }

    let lastNow = performance.now()

    function frame() {
      const now = performance.now()
      let dt = (now - lastNow) / 1000
      lastNow = now
      if (dt > 0.1) dt = 0.1 // clamp after tab switches / long stalls

      // The email icon's glyph whirl runs in every mode (links stay clickable
      // mid-party, so a copy can happen during the dance too).
      advanceWhirl(dt)

      // Dance party owns the field while it runs — no mouse, no physics.
      if (dance.active) {
        if (dance.phase === 'intro') {
          const p = clamp01((now - dance.phaseStart) / 1000 / DANCE_INTRO)
          // Gather the swaying field back to rest as the colours/audio fade in.
          for (const b of blades) b.lean = approach(b.lean, 0, dt, 0.12)
          for (const b of bigBlades) b.lean = approach(b.lean, 0, dt, 0.12)
          audio.volume = p * AUDIO_VOLUME
          drawTransition(now, p, 0)
          if (p >= 1) {
            dance.phase = 'run'
            dance.runStart = now
          }
        } else if (dance.phase === 'run') {
          drawDance(now)
          if ((now - dance.runStart) / 1000 >= DANCE_TOTAL) beginOutro(now)
        } else {
          const p = clamp01((now - dance.phaseStart) / 1000 / DANCE_OUTRO)
          audio.volume = (1 - p) * AUDIO_VOLUME
          drawTransition(now, 1 - p, dance.hueOffset)
          if (nameRef && nameRef.current) {
            const mix = 1 - p
            const s = dance.outroStartRgb || ORANGE_RGB
            const r = (ORANGE_RGB[0] + (s[0] - ORANGE_RGB[0]) * mix) | 0
            const g = (ORANGE_RGB[1] + (s[1] - ORANGE_RGB[1]) * mix) | 0
            const b = (ORANGE_RGB[2] + (s[2] - ORANGE_RGB[2]) * mix) | 0
            nameRef.current.style.color = `rgb(${r} ${g} ${b})`
          }
          if (p >= 1) endDance()
        }
        raf = requestAnimationFrame(frame)
        return
      }

      if (!currentMobile && pointer.active) {
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

      // Scroll wind (mobile only). Lean is proportional to scroll speed. Blades
      // only ever point straight up or straight down — never east. When direction
      // reverses, blades shrink at WIND_LAY rate then snap to the new axis once
      // near-resting (lean < 0.05). Wind runs before settle() and skips it while
      // active to avoid a same-frame fight over lean.
      let windActive = false
      if (currentMobile) {
        scrollVel = approach(scrollVel, 0, dt, 0.2)
        const windStrength = Math.min(1, Math.abs(scrollVel) / WIND_MAX_VEL)
        if (windStrength > 0.02) {
          windActive = true
          const windAngle = scrollVel > 0 ? -Math.PI / 2 : Math.PI / 2
          const applyWind = (b) => {
            if (b.lean < 0.05) {
              // Near-resting: snap angle to axis (no east-swivel) and start growing.
              b.angle = windAngle
              b.targetAngle = windAngle
              b.lean = approach(b.lean, windStrength, dt, WIND_LAY)
            } else if (b.angle === windAngle) {
              // Pointing the right way: grow/shrink lean to match current speed.
              b.targetAngle = windAngle
              b.lean = approach(b.lean, windStrength, dt, WIND_LAY)
            } else {
              // Wrong direction: shrink back to rest; angle stays pinned until lean
              // drops below threshold, then next frame snaps to new direction.
              b.lean = approach(b.lean, 0, dt, WIND_LAY)
            }
          }
          for (const b of blades) applyWind(b)
          for (const b of bigBlades) applyWind(b)
        }
      }

      if (!windActive) {
        for (const b of blades) settle(b, now, dt, GRASS_CFG)
        for (const b of bigBlades) settle(b, now, dt, b.cfg)
      }

      // Freeze the bar's sway instantly when the page opens (it's hidden, so the
      // snap is invisible); ease it back over ~0.6s on close so the bar comes
      // back to life from rest rather than jumping to a mid-sway position.
      const barSwayTarget = projectsOpenRef.current ? 0 : 1
      barSway = approach(barSway, barSwayTarget, dt, barSwayTarget < barSway ? 0 : 0.6)

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

    // Email blade: whirl into the clipboard glyph on hover, back to mail on
    // leave (unless it's showing the post-copy check). Runs in every mode so the
    // hover preview works mid dance-party too, where the links stay live.
    function updateMailHover(hovered) {
      if (!mailBlade) return
      const over = hovered === mailBlade
      if (over && !mailBlade.hover) {
        mailBlade.hover = true
        if (mailBlade.glyph !== 'check') triggerWhirl(mailBlade, 'clipboard')
      } else if (!over && mailBlade.hover) {
        mailBlade.hover = false
        mailBlade.copied = false
        triggerWhirl(mailBlade, 'mail')
      }
    }

    function onMove(e) {
      if (currentMobile) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (dance.active) {
        // Mouse influence is off during the party, but the links stay clickable
        // and hoverable. The pfp can't restart the party, so it isn't a target.
        const hovered = bladeAt(x, y)
        updateMailHover(hovered)
        container.style.cursor = hovered ? 'pointer' : ''
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

      const hovered = bladeAt(x, y)
      updateMailHover(hovered)
      container.style.cursor = hovered || onPfp(x, y) ? 'pointer' : ''
    }

    function onLeave() {
      if (currentMobile) return
      pointer.active = false
      pointer.vx = 0
      pointer.vy = 0
      container.style.cursor = ''
    }

    function onClick(e) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // Clicking the profile picture starts the dance party. Once it's running
      // the pfp is inert — the party has to play out (or fade) on its own.
      if (onPfp(x, y)) {
        if (!dance.active) startDance(performance.now())
        return
      }
      // Links stay clickable throughout — even mid-party.
      const hit = bladeAt(x, y)
      // PROJECTS bar: hand its on-screen geometry up to React, which grows an
      // orange circle out of it into the faked projects page (no navigation).
      if (hit && hit.kind === 'bar') {
        // Snap the bar to its rest position now (before the veil covers it) so
        // the canvas label sits at exactly (b.x, b.y) — the same point as
        // origin.cx/cy — for the entire duration the projects page is open.
        // Without this, residual lean from hovering shifts tipX/tipY away from
        // the rest centre, causing the canvas label to appear at a different
        // position than the overlay title during the closing fade.
        hit.lean = 0
        hit.lastHit = -Infinity
        // If a dance party is on, hand off the bar's live neon hue (and the drift
        // rate) so the projects page keeps cycling colour seamlessly from here.
        // Also hand off how long until the party's colours fade back to orange
        // (the run end) so the page can wind down to orange in step with it.
        const neon = dance.active
        let fadesIn = 0
        if (neon) {
          let outroStart
          if (dance.phase === 'run') outroStart = dance.runStart + DANCE_TOTAL * 1000
          else if (dance.phase === 'intro') outroStart = dance.phaseStart + (DANCE_INTRO + DANCE_TOTAL) * 1000
          else outroStart = dance.phaseStart // already fading out
          fadesIn = (outroStart - performance.now()) / 1000
        }
        const fontPx = hit.drawnFontPx || Math.round(hit.r * 0.95)
        onOpenProjectsRef.current?.({
          // The bar's rest centre (not its live swayed/leaned tip) — the page
          // freezes the bar here, so the veil collapses back to exactly the
          // right spot. labelCx/labelCy are separate nudges just for the title
          // text, correcting for canvas vs CSS font-metric differences.
          cx: rect.left + hit.x,
          cy: rect.top + hit.y,
          labelCx: rect.left + hit.x + fontPx * LABEL_CX_NUDGE,
          labelCy: rect.top + hit.y + fontPx * LABEL_CY_NUDGE,
          r: hit.halfLen + hit.r, // stadium half-width (length + cap)
          h: hit.r, // stadium half-height (the bar's radius)
          fontPx, // match the label's real size
          neon,
          hue: neon ? (((hit.liveHue || 0) % 360) + 360) % 360 : 0,
          hueDrift: DANCE_HUE_DRIFT,
          fadesIn, // s until the party fades to orange
          fadeDur: DANCE_OUTRO, // s the fade-to-orange takes
        })
        return
      }
      // Email: copy to clipboard and whirl into a check mark instead of opening.
      if (hit && hit === mailBlade) {
        navigator.clipboard?.writeText(mailBlade.email).catch(() => {})
        mailBlade.copied = true
        triggerWhirl(mailBlade, 'check')
        return
      }
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
      audio.pause()
      container.removeEventListener('click', onClick)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', onScroll)
    }
  }, [containerRef, nameRef])

  return <canvas ref={canvasRef} className="grass-canvas" aria-hidden="true" />
}
