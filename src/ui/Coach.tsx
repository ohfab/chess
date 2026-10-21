import type { ReactNode } from 'react'
import { Piece } from '../board/Piece'
import { Badge } from '../review/Badge'
import type { Judgement } from '../review/review'

interface Props {
  judgement?: Judgement
  title?: ReactNode
  children?: ReactNode
  progress?: number
  actions?: ReactNode
}

/** Speech bubble from the Knightly coach, chess.com review style. */
export function Coach({ judgement, title, children, progress, actions }: Props) {
  return (
    <div className="coach">
      <Piece role="knight" color="white" className="coach-avatar" />
      <div className="coach-bubble">
        {(judgement || title) && (
          <div className="coach-title">
            {judgement && <Badge judgement={judgement} size={28} />}
            {title}
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
