// A short burst of confetti over the page, for records, mastered variations and new levels.
// Imperative on purpose: any feature calls celebrate() at the moment something good happens.

const COLORS = ['#416b59', '#f8a498', '#e8a23a', '#7fbf3f', '#ffffff', '#2f4f42']

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  angle: number
  size: number
  color: string
  round: boolean
}

/** Throws confetti from `origin` (page coordinates; default: the top centre of the screen). */
export function celebrate({ origin, count = 90 }: { origin?: { x: number; y: number }; count?: number } = {}) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.className = 'confetti'
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()
  ctx.scale(dpr, dpr)
  const from = origin ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.28 }
  const bits: Bit[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
    const speed = 6 + Math.random() * 8
    return {
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI,
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.3,
    }
  })
  const start = performance.now()
  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    for (const b of bits) {
      b.vy += 0.32
      b.vx *= 0.985
      b.x += b.vx
      b.y += b.vy
      b.angle += b.spin
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - t / 1800)
      ctx.translate(b.x, b.y)
      ctx.rotate(b.angle)
      ctx.fillStyle = b.color
      if (b.round) {
        ctx.beginPath()
        ctx.arc(0, 0, b.size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
      ctx.restore()
    }
    if (t < 1800) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
