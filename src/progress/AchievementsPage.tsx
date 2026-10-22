import { ArrowLeft, Flame, Lock, Puzzle, Trophy } from 'lucide-react'
import { locale, t } from '../i18n/i18n'
import { Display } from '../ui/Display'
import { CATEGORIES, MAX_LEVEL, TIER_NAMES } from './achievements'
import { LevelRing } from './LevelBadge'
import { useProgress, type AchievementState } from './useProgress'
import './progress.css'

const format = (n: number) => n.toLocaleString(locale())

function AchievementCard({ a }: { a: AchievementState }) {
  const { def, value, tier, next } = a
  const done = next === null
  const unlocked = tier > 0
  // progress towards the next tier, from the one before it
  const from = tier > 0 ? def.tiers[tier - 1] : 0
  const share = done ? 1 : Math.min(1, Math.max(0, (value - from) / (next - from)))
  const target = next ?? def.tiers[def.tiers.length - 1]
  const unit = def.percent ? ' %' : ''
  return (
    <div className={`pg-card ${unlocked ? 'on' : ''} ${done ? 'done' : ''}`}>
      <span className={`pg-medal tier-${def.tiers.length > 1 ? tier : unlocked ? 'one' : 0}`}>{unlocked ? <def.icon size={22} /> : <Lock size={18} />}</span>
      <span className="pg-card-text">
        <b>{t(def.title)}</b>
        <span className="muted">{target === 1 && def.one ? t(def.one) : t(def.text, { n: format(target) })}</span>
        {!done && (
          <span className="pg-bar" aria-label={t('{value} von {target}', { value: format(value), target: format(next!) })}>
            <i style={{ width: `${share * 100}%` }} />
          </span>
        )}
        <span className="pg-card-meta">
          {def.tiers.length > 1 && (
            <span className="pg-tiers" aria-hidden>
              {def.tiers.map((_, i) => (
                <i key={i} className={`tier-${i + 1} ${i < tier ? 'on' : ''}`} />
              ))}
            </span>
          )}
          <span>
            {done
              ? def.tiers.length > 1
                ? t(TIER_NAMES[tier - 1])
                : t('Geschafft')
              : `${format(Math.min(value, next!))}${unit} / ${format(next!)}${unit}`}
          </span>
        </span>
      </span>
    </div>
  )
}

/** Level, XP and all achievements. */
export function AchievementsPage({ onBack }: { onBack: () => void }) {
  const p = useProgress()
  const unlocked = p.achievements.filter((a) => a.tier > 0)
  const recent = unlocked
    .filter((a) => a.unlockedAt)
    .sort((a, b) => b.unlockedAt! - a.unlockedAt!)
    .slice(0, 4)
  return (
    <div className="pg-page">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Heute')}
      </button>
      <Display first={t('Deine')} second={t('Erfolge')} />

      <section className="pg-level">
        <LevelRing share={p.into / p.span} size={112} stroke={8}>
          <span className="pg-level-small">{t('Level')}</span>
          <b>{p.level}</b>
        </LevelRing>
        <div className="pg-level-text">
          <span className="pg-eyebrow">{t(p.name)}</span>
          <b>{t('{xp} XP', { xp: format(p.xp) })}</b>
          <span className="pg-bar light">
            <i style={{ width: `${(p.into / p.span) * 100}%` }} />
          </span>
          <span className="pg-level-next">
            {p.level >= MAX_LEVEL ? t('Höchstes Level erreicht') : t('Noch {n} XP bis Level {next}', { n: format(p.span - p.into), next: p.level + 1 })}
          </span>
        </div>
        <div className="pg-level-stats">
          <span>
            <Trophy size={16} />
            <b>
              {unlocked.length}/{p.achievements.length}
            </b>
          </span>
          <span title={t('Längste Serie')}>
            <Flame size={16} />
            <b>{p.bestStreak}</b>
          </span>
          <span title={t('Beste Taktik-Wertung')}>
            <Puzzle size={16} />
            <b>{p.bestRating}</b>
          </span>
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="section-head">
            <h3>{t('Zuletzt freigeschaltet')}</h3>
          </div>
          <div className="pg-grid">
            {recent.map((a) => (
              <AchievementCard key={a.def.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {CATEGORIES.map((c) => {
        const list = p.achievements.filter((a) => a.def.category === c.id)
        return (
          <section key={c.id}>
            <div className="section-head">
              <h3>{t(c.name)}</h3>
              <span className="muted">
                {list.filter((a) => a.tier > 0).length}/{list.length}
              </span>
            </div>
            <div className="pg-grid">
              {list.map((a) => (
                <AchievementCard key={a.def.id} a={a} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
