import { BOT_FACES } from './bot-faces.data'
import { levelOf } from '../engine/levels'
import './play.css'

type Run = [x: number, y: number, w: number, tone: string]

const SIZE = BOT_FACES[0].length

// one rect per horizontal run of a tone, worked out once per face
const cache = new Map<number, Run[]>()
function runsOf(level: number): Run[] {
  const hit = cache.get(level)
  if (hit) return hit
  const out: Run[] = []
  BOT_FACES[Math.min(Math.max(level, 1), BOT_FACES.length) - 1].forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const tone = row[x]
      let w = 1
      while (row[x + w] === tone) w++
      if (tone !== '.' && tone !== 'l') out.push([x, y, w, tone])
      x += w
    }
  })
  cache.set(level, out)
  return out
}

/** The opponent's pixel-art face: its emoji in pixels, on a tile in the four olive tones. */
export function BotAvatar({ level, className = '' }: { level: number; className?: string }) {
  return (
    <span className={`pixel-bot ${className}`} title={levelOf(level).name}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} shapeRendering="crispEdges" aria-hidden>
        <rect className="px-l" width={SIZE} height={SIZE} />
        {runsOf(level).map(([x, y, w, tone]) => (
          <rect key={`${x}:${y}`} className={`px-${tone}`} x={x} y={y} width={w} height={1} />
        ))}
      </svg>
    </span>
  )
}
