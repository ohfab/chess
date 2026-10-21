import type { ReactNode } from 'react'
import { Piece } from '../board/Piece'
import type { Score } from '../engine/engine'
import { formatScore } from '../engine/useEngine'
import { Badge } from '../review/Badge'
import type { Judgement } from '../review/review'

interface Props {
  judgement?: Judgement
  title?: ReactNode
  children?: ReactNode
  progress?: number
  actions?: ReactNode
  /** engine score after the move, from White's view */
  score?: Score | null
}

/** Speech bubble from the Knightly coach, chess.com review style. */
export function Coach({ judgement, title, children, progress, actions, score }: Props) {
  return (
    <div className="coach">
      <Piece role="knight" color="white" className="coach-avatar" />
      <div className="coach-bubble">
        {(judgement || title) && (
          <div className="coach-title">
            {judgement && <Badge judgement={judgement} size={28} />}
            {title}
            {score && (
              <span className={`coach-eval ${('mate' in score ? score.mate : score.cp) < 0 ? 'neg' : ''}`}>{formatScore(score)}</span>
            )}
          </div>
        )}
        {children && <div className="coach-text">{children}</div>}
        {progress !== undefined && (
          <div className="progress">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {actions && <div className="coach-actions">{actions}</div>}
      </div>
    </div>
  )
}
