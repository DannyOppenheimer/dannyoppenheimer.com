import { useEffect, useRef } from 'react'

/* ---------------------------------------------------------------------------
   CursorTrail
   Draws the custom arrow cursor and a shape-matched extrusion trail behind it,
   both on one shared canvas. The trail is the cursor's own silhouette stamped
   at intervals along the recent path, so it looks like the cursor's edges are
   stretching and bleeding out behind the direction of motion.
   --------------------------------------------------------------------------- */

const CURSOR_SIZE = 24 * 1.6  // px — the cursor's longer dimension
const HOT_X      = 0.16       // hotspot (tip) as a fraction of drawn width
const HOT_Y      = 0.12       // hotspot (tip) as a fraction of drawn height

// ── Trail tuning ─────────────────────────────────────────────────────────────
const HISTORY_SIZE     = 150   // ring-buffer depth (frames of history)
const EXTRUSION_DECAY  = 0.75  // EMA factor — lower = snappier build-up & retract
const SPEED_SCALE      = 2.2   // extrusion px added per px/frame of raw speed
const MAX_EXTRUSION_PX = 28    // hard cap on trail length (px)
const STAMP_EVERY_PX   = 3     // drop a silhouette stamp every N path-pixels
// ─────────────────────────────────────────────────────────────────────────────

export default function CursorTrail() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches
    if (!fine) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const ratio = 3.05389 / 2.6973157  // svg viewBox width / height
    const cw = CURSOR_SIZE
    const ch = CURSOR_SIZE / ratio

    // ── Load cursor SVG and pre-render its black silhouette ──────────────────
    // The silhouette is created once on load so we never touch ctx.filter at
    // runtime — drawing a cached canvas element per stamp is much faster.
    const img = new Image()
    let imgReady  = false
    let silCanvas = null  // offscreen canvas holding the black silhouette

    img.onload = () => {
      imgReady = true

      silCanvas = document.createElement('canvas')
      silCanvas.width  = Math.ceil(cw * dpr)
      silCanvas.height = Math.ceil(ch * dpr)
      const silCtx = silCanvas.getContext('2d')
      silCtx.scale(dpr, dpr)
      // Draw the real cursor, then composite a black fill over every opaque
      // pixel — result is a solid-black cutout of the cursor shape.
      silCtx.drawImage(img, 0, 0, cw, ch)
      silCtx.globalCompositeOperation = 'source-in'
      silCtx.fillStyle = '#0a0d0d'
      silCtx.fillRect(0, 0, cw, ch)
    }
    img.src = '/cursor.svg'

    let width = 0
    let height = 0
    function resize() {
      width  = window.innerWidth
      height = window.innerHeight
      canvas.width  = Math.round(width  * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width  = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    let headX = -9999, headY = -9999
    let prevX = -9999, prevY = -9999
    let seen = false, inside = false

    // Ring buffer of CSS-pixel mouse positions.
    const history = []
    // Smoothed extrusion length (px). EMA decays toward 0 when mouse is still,
    // which causes the trail to retract naturally without any threshold or timer.
    let smoothExtruPx = 0

    function onMove(e) {
      headX = e.clientX
      headY = e.clientY
      seen   = true
      inside = true
    }
    function onOut(e) {
      if (!e.relatedTarget && !e.toElement) inside = false
    }

    // Hide the native cursor everywhere while ours is active.
    const style = document.createElement('style')
    style.textContent = '*, *::before, *::after { cursor: none !important }'
    document.head.appendChild(style)

    let raf = 0
    function frame() {
      ctx.clearRect(0, 0, width, height)

      if (seen && inside) {
        // ── Speed → extrusion length EMA ──────────────────────────────────────
        // Raw distance moved this frame (guarded against first-frame sentinel).
        const rawSpeed = (prevX === -9999)
          ? 0
          : Math.sqrt((headX - prevX) ** 2 + (headY - prevY) ** 2)

        // Smooth the target extrusion length so it can't flicker: the EMA
        // tracks rawSpeed × scale but decays smoothly to 0 on its own, with
        // no hard threshold to snap on/off at.
        const targetPx = Math.min(rawSpeed * SPEED_SCALE, MAX_EXTRUSION_PX)
        smoothExtruPx  = smoothExtruPx * EXTRUSION_DECAY + targetPx * (1 - EXTRUSION_DECAY)

        history.push({ x: headX, y: headY })
        if (history.length > HISTORY_SIZE) history.shift()
        prevX = headX
        prevY = headY

        // ── Silhouette stamps ──────────────────────────────────────────────────
        // Walk backward along the recorded path by arc-length, collecting a
        // stamp position every STAMP_EVERY_PX pixels until we've covered
        // smoothExtruPx total pixels (or run out of history).
        if (silCanvas && smoothExtruPx >= 1 && history.length >= 2) {
          const stamps = []
          let arcDist  = 0
          let nextStop = STAMP_EVERY_PX

          outer: for (let i = history.length - 2; i >= 0; i--) {
            const ax = history[i + 1].x, ay = history[i + 1].y  // recent end
            const bx = history[i].x,     by = history[i].y      // older end
            const dx = bx - ax, dy = by - ay
            const seg = Math.sqrt(dx * dx + dy * dy)
            if (seg === 0) continue

            // Emit every stamp threshold that falls within this segment.
            while (nextStop <= arcDist + seg) {
              if (nextStop > smoothExtruPx) break outer
              const t = (nextStop - arcDist) / seg
              stamps.push({ x: ax + dx * t, y: ay + dy * t })
              nextStop += STAMP_EVERY_PX
            }

            arcDist += seg
            if (arcDist >= smoothExtruPx) break
          }

          // Draw oldest stamp first so the one nearest the cursor sits on top,
          // creating a continuous solid extrusion that blends into the cursor.
          for (let i = stamps.length - 1; i >= 0; i--) {
            const p = stamps[i]
            // silCanvas is cw*dpr × ch*dpr px; specifying cw × ch CSS units
            // lets the DPR transform render it at full physical resolution.
            ctx.drawImage(silCanvas, p.x - cw * HOT_X, p.y - ch * HOT_Y, cw, ch)
          }
        }
      }

      // ── Real cursor — drawn last so it always sits above the extrusion ─────
      if (seen && inside && imgReady) {
        ctx.drawImage(img, headX - cw * HOT_X, headY - ch * HOT_Y, cw, ch)
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerout', onOut)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onOut)
      window.removeEventListener('resize', resize)
      style.remove()
    }
  }, [])

  return <canvas ref={canvasRef} className="cursor-canvas" aria-hidden="true" />
}
