import { levelOf } from '../engine/levels'
import type { Color } from '../game/rules'
import type { Progress } from '../game/store'
import { t, tn, type Lang } from '../i18n/i18n'
import { themeName } from '../puzzles/themes'
import { CATALOG } from '../trainer/catalog'
import { MOTIFS, type Insights, type Phase } from './insights'

// A day's training: a handful of tasks, each one something the app can start directly.
// Candidates come from the insights; the AI coach picks and explains them, and without it
// the same candidates are taken in order of need.

export type TaskKind = 'mistakes' | 'puzzles' | 'opening' | 'game'

export interface PlanTask {
  id: string
  kind: TaskKind
  title: string
  /** why this, today */
  reason: string
  /** how many items make the task done */
  target: number
  done: number
  theme?: string
  openingId?: string
  variation?: number
  side?: Color
  level?: number
}

export interface DailyPlan {
  date: string
  tasks: PlanTask[]
  /** the coach's words; written by Claude when available */
  summary: string
  focus: { title: string; why: string; tip: string }[]
  byAI: boolean
}

export const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD in local time

const pct = (x: number) => `${Math.round(x * 100)} %`

const openingTitle = (opening: string, variation: string) => t('Eröffnung: {opening} · {variation}', { opening, variation })

/** Why the weakest phase gets its own block; one sentence per phase for the grammar. */
const phaseReason = (phase: Phase, rate: number) =>
  phase === 'opening'
    ? t('In der Eröffnung passieren dir die meisten Fehler ({pct} deiner Züge).', { pct: pct(rate) })
    : phase === 'middlegame'
      ? t('Im Mittelspiel passieren dir die meisten Fehler ({pct} deiner Züge).', { pct: pct(rate) })
      : t('Im Endspiel passieren dir die meisten Fehler ({pct} deiner Züge).', { pct: pct(rate) })

/** Everything worth doing today, most needed first. */
export function candidates(
  ins: Insights,
  ctx: {
    progress: Record<string, Progress>
    solvedMistakes: Set<string>
    level: number
    side: Color
    /** the language the texts come out in (the current one); callers memoize on it */
    lang?: Lang
  },
): PlanTask[] {
  const out: PlanTask[] = []
  const open = ins.mistakes.filter((m) => !ctx.solvedMistakes.has(`${m.gameKey}:${m.ply}`))

  if (open.length >= 1) {
    const blunders = open.filter((m) => m.judgement === 'blunder').length
    out.push({
      id: 'mistakes',
      kind: 'mistakes',
      title: t('Deine Fehler wiederholen'),
      reason: blunders
        ? tn(
            open.length,
            'Eine Stellung aus deinen Partien, in denen es einen viel besseren Zug gab, davon {blunders} Patzer.',
            '{n} Stellungen aus deinen Partien, in denen es einen viel besseren Zug gab, davon {blunders} Patzer.',
            { blunders },
          )
        : tn(open.length, 'Eine Stellung aus deinen Partien, in denen es einen viel besseren Zug gab.', '{n} Stellungen aus deinen Partien, in denen es einen viel besseren Zug gab.'),
      target: Math.min(5, open.length),
      done: 0,
    })
  }

  for (const { motif, count } of ins.motifs.slice(0, 3)) {
    const m = MOTIFS[motif]
    out.push({
      id: `puzzles:${m.theme}`,
      kind: 'puzzles',
      theme: m.theme,
      title: t('Taktik: {theme}', { theme: themeName(m.theme) }),
      reason: t('{motif}: {n}× in deinen letzten Partien. {advice}', { motif: m.name, n: count, advice: m.advice }),
      target: 5,
      done: 0,
    })
  }

  // the phase with the highest error rate gets its own block
  const worst = (Object.entries(ins.phases) as [Phase, Insights['phases']['opening']][])
    .filter(([, p]) => p.moves >= 10)
    .sort((a, b) => b[1].rate - a[1].rate)[0]
  if (worst && worst[1].rate > 0.04) {
    const theme = worst[0] === 'endgame' ? 'endgame' : worst[0] === 'opening' ? 'opening' : 'kingsideAttack'
    if (!out.some((t) => t.theme === theme))
      out.push({
        id: `puzzles:${theme}`,
        kind: 'puzzles',
        theme,
        title: t('Taktik: {theme}', { theme: themeName(theme) }),
        reason: phaseReason(worst[0], worst[1].rate),
        target: 5,
        done: 0,
      })
  }

  // opening: the weakest drilled variation, else an opening the games keep reaching
  const drilled = Object.entries(ctx.progress)
    .map(([key, p]) => ({ key, ...p, ratio: p.clean / p.runs }))
    .filter((p) => p.runs > 0)
    .sort((a, b) => a.ratio - b.ratio || b.runs - a.runs)[0]
  if (drilled && drilled.ratio < 0.8) {
    const [openingId, v, side] = drilled.key.split(':')
    const o = CATALOG.find((x) => x.id === openingId)
    if (o?.variations[Number(v)])
      out.push({
        id: `opening:${drilled.key}`,
        kind: 'opening',
        openingId,
        variation: Number(v),
        side: side as Color,
        title: openingTitle(o.name, o.variations[Number(v)].name),
        reason: t('Bisher {clean} von {runs} Durchgängen fehlerfrei.', { clean: drilled.clean, runs: drilled.runs }),
        target: 1,
        done: 0,
      })
  }
  const reached = ins.openings.find((o) => o.earlyErrors > 0 && o.catalog)
  if (reached?.catalog && !out.some((t) => t.kind === 'opening')) {
    const { openingId, variation, side } = reached.catalog
    const o = CATALOG.find((x) => x.id === openingId)!
    out.push({
      id: `opening:${openingId}:${variation}:${side}`,
      kind: 'opening',
      openingId,
      variation,
      side,
      title: openingTitle(o.name, o.variations[variation].name) + (side !== o.side ? ` ${side === 'white' ? t('(als Weiß)') : t('(als Schwarz)')}` : ''),
      reason: tn(
        reached.games,
        'Eine Partie in dieser Eröffnung, {errors} Fehler schon in den ersten zehn Zügen.',
        '{n} Partien in dieser Eröffnung, {errors} Fehler schon in den ersten zehn Zügen.',
        { errors: reached.earlyErrors },
      ),
      target: 1,
      done: 0,
    })
  }

  const level = ins.suggestedLevel
  out.push({
    id: `game:${level}`,
    kind: 'game',
    level,
    title: t('Partie gegen {level}', { level: levelOf(level).label }),
    reason:
      ins.games < 3
        ? t('Eine Partie zeigt dem Coach, wo du stehst.')
        : level > ctx.level
          ? t('Du gewinnst zuletzt sicher: Zeit für einen stärkeren Gegner.')
          : t('Eine ernste Partie auf deinem Niveau, danach wird sie ausgewertet.'),
    target: 1,
    done: 0,
  })

  // nothing to go on yet: a general tactics mix and an opening to start with
  if (!out.some((t) => t.kind === 'puzzles'))
    out.unshift({
      id: 'puzzles:mix',
      kind: 'puzzles',
      title: t('Taktik-Mix'),
      reason: t('Fünf Aufgaben quer durch alle Motive, passend zu deiner Wertung.'),
      target: 5,
      done: 0,
    })
  if (!out.some((t) => t.kind === 'opening')) {
    const o = CATALOG.find((x) => x.id === (ctx.side === 'white' ? 'italian' : 'caro-kann'))!
    out.push({
      id: `opening:${o.id}:0:${o.side}`,
      kind: 'opening',
      openingId: o.id,
      variation: 0,
      side: o.side,
      title: openingTitle(o.name, o.variations[0].name),
      reason: t('Eine solide Eröffnung, mit der du die Theorie-Prüfung kennenlernst.'),
      target: 1,
      done: 0,
    })
  }
  return out
}

/** Without the AI: take the first few candidates, mixing kinds. */
export function localPlan(ins: Insights, tasks: PlanTask[]): DailyPlan {
  const picked: PlanTask[] = []
  for (const kind of ['mistakes', 'puzzles', 'opening', 'puzzles', 'game'] as TaskKind[]) {
    const t = tasks.find((x) => x.kind === kind && !picked.includes(x))
    if (t) picked.push(t)
  }
  const top = ins.motifs[0]
  const summary =
    ins.reviewed === 0
      ? t('Noch keine ausgewerteten Partien. Spiel eine Partie oder trainiere eine Eröffnung, dann erkennt der Coach deine Muster.')
      : [
          ins.accuracy.average !== null && t('Deine Genauigkeit liegt im Schnitt bei {accuracy} %.', { accuracy: ins.accuracy.average.toFixed(1) }),
          top && t('Am häufigsten: {motif} ({n}×).', { motif: MOTIFS[top.motif].name, n: top.count }),
          t('Der Plan setzt genau dort an.'),
        ]
          .filter(Boolean)
          .join(' ')
  return {
    date: today(),
    tasks: picked.slice(0, 5),
    summary,
    focus: ins.motifs.slice(0, 3).map(({ motif, count }) => ({ title: MOTIFS[motif].name, why: t('{n}× in deinen Partien', { n: count }), tip: MOTIFS[motif].advice })),
    byAI: false,
  }
}
