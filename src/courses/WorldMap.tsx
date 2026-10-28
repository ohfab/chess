import { ArrowLeft, Check, Lock, Map as MapIcon, Play, Star } from 'lucide-react'
import { t } from '../i18n/i18n'
import { themeName } from '../puzzles/themes'
import { Display } from '../ui/Display'
import { COURSE_ICON } from './icons'
import { STARS, WORLDS } from './lessons'
import { useCourseStates, type CourseState } from './progress'
import { Bar, Stars } from './Stars'
import { setUnlockAll } from './store'

const COLS = 3

/** The overview: every world with its levels on a winding path, like a game's world map. */
export function WorldMap({ onBack, onOpen }: { onBack: () => void; onOpen: (theme: string) => void }) {
  const { states, next, unlockAll } = useCourseStates()
  const total = states.reduce((n, s) => n + s.stars, 0)
  const max = states.length * STARS.length
  const anyLocked = states.some((s) => s.locked)
  const NextIcon = next ? COURSE_ICON[next.theme] : null

  return (
    <div className="courses">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Taktik')}
      </button>
      <div className="page-head">
        <Display first={t('Kurse')} second={t('Level für Level')} />
        <p className="muted">{t('Jeder Kurs zeigt dir ein Motiv an einer echten Stellung. Danach übst du es an Aufgaben und sammelst Sterne.')}</p>
      </div>

      <div className="c-top">
        {next && NextIcon && (
          <button className="link-card c-next" onClick={() => onOpen(next.theme)}>
            <span className="c-tile small">
              <NextIcon size={22} />
            </span>
            <span className="c-next-text">
              <span className="c-kicker">
                {t('Weiter mit')} · {next.world}-{next.level}
              </span>
              <b>{themeName(next.theme)}</b>
              <Stars n={next.stars} />
            </span>
            <Play size={22} className="c-next-go" />
          </button>
        )}
        <div className="c-total">
          <span className="c-kicker">{t('Alle Kurse')}</span>
          <b>
            {total} / {max}
          </b>
          <Bar share={total / max} label={t('{n} von {total} Sternen', { n: total, total: max })} />
        </div>
      </div>

      <div className="c-worlds">
        {WORLDS.map((world, wi) => {
          const courses = states.filter((s) => s.world === wi + 1)
          const stars = courses.reduce((n, s) => n + s.stars, 0)
          const rows: CourseState[][] = []
          for (let i = 0; i < courses.length; i += COLS) rows.push(courses.slice(i, i + COLS))
          return (
            <section key={wi} className="c-world" style={{ animationDelay: `${wi * 60}ms` }}>
              <header className="c-world-head">
                <span className="c-world-no">
                  <MapIcon size={14} /> {t('Welt {n}', { n: wi + 1 })}
                </span>
                <span className="c-world-stars" aria-label={t('{n} von {total} Sternen', { n: stars, total: courses.length * STARS.length })}>
                  <Star size={12} fill="currentColor" /> {stars}/{courses.length * STARS.length}
                </span>
                <h3>{t(world.name)}</h3>
                <span className="muted">{t(world.about)}</span>
              </header>
              <div className="c-map">
                {rows.map((row, ri) => {
                  // the path snakes: left to right, then right to left
                  const col = (i: number) => (ri % 2 ? COLS - 1 - i : i)
                  const cols = row.map((_, i) => col(i))
                  const x = (c: number) => `${((c * 2 + 1) / (COLS * 2)) * 100}%`
                  const end = cols[cols.length - 1]
                  return (
                    <div key={ri} className="c-row">
                      {row.length > 1 && <i className="c-track h" style={{ left: x(Math.min(...cols)), right: `calc(100% - ${x(Math.max(...cols))})` }} />}
                      {ri < rows.length - 1 && <i className="c-track v" style={{ left: x(end) }} />}
                      {row.map((s, i) => (
                        <Node key={s.theme} state={s} next={next?.theme === s.theme} column={col(i)} onOpen={onOpen} />
                      ))}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <div className="c-foot">
        <p className="muted">
          {t('Sterne gibt es für gelöste Aufgaben des Motivs: einen ab {a}, zwei ab {b}, drei ab {c}.', { a: STARS[0], b: STARS[1], c: STARS[2] })}{' '}
          {anyLocked || unlockAll ? t('Ein Stern öffnet das nächste Level.') : ''}
        </p>
        {(anyLocked || unlockAll) && (
          <button className="btn-secondary small" onClick={() => setUnlockAll(!unlockAll)}>
            {unlockAll ? <Lock size={14} /> : <Check size={14} />} {unlockAll ? t('Reihenfolge einhalten') : t('Alle freischalten')}
          </button>
        )}
      </div>
    </div>
  )
}

function Node({ state: s, next, column, onOpen }: { state: CourseState; next: boolean; column: number; onOpen: (theme: string) => void }) {
  const Icon = s.locked ? Lock : COURSE_ICON[s.theme]
  const name = themeName(s.theme)
  const kind = s.locked ? 'locked' : s.stars >= STARS.length ? 'done' : next ? 'next' : 'open'
  return (
    <button
      className={`c-node ${kind}`}
      style={{ gridColumn: column + 1 }}
      disabled={s.locked}
      title={s.locked ? t('Hol dir einen Stern im Level davor.') : undefined}
      aria-label={`${s.world}-${s.level} ${name}${s.locked ? ` (${t('gesperrt')})` : ''}`}
      onClick={() => onOpen(s.theme)}
    >
      {next && <span className="c-here">{t('Hier')}</span>}
      <span className="c-tile">
        <Icon size={26} />
        <span className="c-tile-no">
          {s.world}-{s.level}
        </span>
        {s.read && !s.locked && (
          <span className="c-tile-read" title={t('Lektion gelesen')}>
            <Check size={10} />
          </span>
        )}
      </span>
      <Stars n={s.stars} />
      <span className="c-name">{name}</span>
    </button>
  )
}
