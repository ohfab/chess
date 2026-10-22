import { JUDGEMENT, type Judgement } from './review'
import { circle, GLYPH } from './glyphs'

export function Badge({ judgement, size = 20 }: { judgement: Judgement; size?: number }) {
  return (
    <svg
      className={`badge badge-${judgement}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={JUDGEMENT[judgement].label}
      dangerouslySetInnerHTML={{ __html: circle(judgement) + GLYPH[judgement] }}
    />
  )
}
